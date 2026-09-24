"use strict";
/**
 * Event Router
 *
 * Receives inbound runtime events (from webhooks, polling, or internal signals)
 * and routes them to the relevant Clones based on:
 *   1. Is the integration connected to this company?
 *   2. Does the Clone have this provider assigned?
 *   3. Does the Clone's compiled runtime list this event as relevant?
 *   4. Is the event deduplicated?
 *
 * Rule: do NOT wake every Clone for every company event.
 * Only wake Clones for whom the event is provably relevant.
 *
 * Flow:
 *   inbound event
 *     → validate
 *     → deduplicate (deduplicationKey in DB)
 *     → find company's connected providers
 *     → find all Clones with compiled runtimes
 *     → filter by relevance
 *     → for each relevant Clone: create RuntimeExecution (QUEUED)
 *     → mark RuntimeEvent as processed
 *     → return list of queued executions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRouter = void 0;
const database_1 = require("@clone/database");
const integration_framework_1 = require("@clone/integration-framework");
class EventRouter {
    /**
     * Route an inbound event through the full pipeline.
     * Returns the list of executions that were created and queued.
     */
    async routeEvent(inbound) {
        const { companyId, source, eventType, payload, deduplicationKey } = inbound;
        // Build the canonical event ID: "provider.event_type"
        const canonicalEventId = `${source}.${eventType}`;
        // ── 1. Deduplication ────────────────────────────────────────────────────
        if (deduplicationKey) {
            const existing = await database_1.prisma.runtimeEvent.findFirst({
                where: { deduplicationKey },
            });
            if (existing) {
                return {
                    eventId: existing.id,
                    deduplicated: true,
                    routedTo: [],
                    skippedClones: 0,
                };
            }
        }
        // ── 2. Persist the event ────────────────────────────────────────────────
        const runtimeEvent = await database_1.prisma.runtimeEvent.create({
            data: {
                companyId,
                source,
                eventType,
                payload,
                deduplicationKey: deduplicationKey || null,
            },
        });
        // ── 3. Verify the integration is connected ──────────────────────────────
        const connectedAccount = await database_1.prisma.connectedAccount.findFirst({
            where: { companyId, provider: source, status: "CONNECTED" },
        });
        if (!connectedAccount) {
            // Integration not connected — still stored but no Clones woken
            await database_1.prisma.runtimeEvent.update({
                where: { id: runtimeEvent.id },
                data: { processedAt: new Date() },
            });
            return {
                eventId: runtimeEvent.id,
                deduplicated: false,
                routedTo: [],
                skippedClones: 0,
            };
        }
        // ── 4. Find all compiled runtimes for this company ──────────────────────
        const compiledStates = await database_1.prisma.compiledRuntimeState.findMany({
            where: { companyId },
        });
        if (compiledStates.length === 0) {
            await database_1.prisma.runtimeEvent.update({
                where: { id: runtimeEvent.id },
                data: { processedAt: new Date() },
            });
            return {
                eventId: runtimeEvent.id,
                deduplicated: false,
                routedTo: [],
                skippedClones: 0,
            };
        }
        // ── 5. Load clone details for name/role ─────────────────────────────────
        const cloneIds = compiledStates.map((s) => s.cloneId);
        const clones = await database_1.prisma.aIEmployee.findMany({
            where: { companyId },
        });
        const cloneMap = new Map(clones.map((c) => [c.id, c]));
        // ── 6. Check relevance + create executions ──────────────────────────────
        const routedTo = [];
        let skippedClones = 0;
        for (const state of compiledStates) {
            const relevantEvents = state.relevantEvents || [];
            if (!relevantEvents.includes(canonicalEventId)) {
                skippedClones++;
                continue;
            }
            const clone = cloneMap.get(state.cloneId);
            if (!clone) {
                skippedClones++;
                continue;
            }
            // Skip paused clones
            if (clone.status === "PAUSED") {
                skippedClones++;
                continue;
            }
            // Get event definition for reason text
            const eventDef = (0, integration_framework_1.findRuntimeEvent)(canonicalEventId);
            const reason = eventDef
                ? `${eventDef.name} triggered by ${source} — relevant to ${clone.name}'s role (${clone.role}) and compiled runtime.`
                : `Event ${canonicalEventId} matched ${clone.name}'s compiled runtime.`;
            // Create RuntimeExecution in QUEUED state
            const execution = await database_1.prisma.runtimeExecution.create({
                data: {
                    companyId,
                    cloneId: clone.id,
                    status: "QUEUED",
                    triggerSource: canonicalEventId,
                    input: {
                        eventId: runtimeEvent.id,
                        source,
                        eventType,
                        payload,
                    },
                    startedAt: new Date(),
                    stepLog: [
                        {
                            step: 1,
                            state: "QUEUED",
                            timestamp: new Date(),
                            details: `Execution queued. ${reason}`,
                        },
                    ],
                },
            });
            routedTo.push({
                cloneId: clone.id,
                cloneName: clone.name,
                cloneRole: clone.role,
                executionId: execution.id,
                eventId: canonicalEventId,
                reason,
            });
            // Log activity
            await database_1.prisma.activityLog.create({
                data: {
                    companyId,
                    employeeId: clone.id,
                    actorName: "Runtime Engine",
                    action: "CLONE_ACTIVATED",
                    resource: canonicalEventId,
                    details: reason,
                },
            });
        }
        // ── 7. Mark event as processed ──────────────────────────────────────────
        await database_1.prisma.runtimeEvent.update({
            where: { id: runtimeEvent.id },
            data: { processedAt: new Date() },
        });
        return {
            eventId: runtimeEvent.id,
            deduplicated: false,
            routedTo,
            skippedClones,
        };
    }
    /**
     * Determine whether a specific Clone should react to an event.
     * Used for single-clone relevance checks without routing the full event.
     */
    async isRelevantForClone(cloneId, companyId, canonicalEventId) {
        const state = await database_1.prisma.compiledRuntimeState.findFirst({
            where: { cloneId, companyId },
        });
        if (!state) {
            return {
                relevant: false,
                reason: "No compiled runtime found. Run compileRuntime() first.",
            };
        }
        const relevant = (state.relevantEvents || []).includes(canonicalEventId);
        return {
            relevant,
            reason: relevant
                ? `Event ${canonicalEventId} is in Clone's compiled relevant events.`
                : `Event ${canonicalEventId} is not relevant to this Clone's identity, integrations, or responsibilities.`,
        };
    }
    /**
     * Get unprocessed events for a company (useful for catch-up processing).
     */
    async getPendingEvents(companyId, limit = 50) {
        return database_1.prisma.runtimeEvent.findMany({
            where: { companyId, processedAt: null },
            take: limit,
        });
    }
}
exports.EventRouter = EventRouter;
//# sourceMappingURL=event-router.js.map