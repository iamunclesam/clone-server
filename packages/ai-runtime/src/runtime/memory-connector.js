"use strict";
/**
 * Memory Connector
 *
 * Bridges runtime execution results to persistent EmployeeMemory.
 *
 * After each execution completes, the runtime calls extractAndStore() to
 * determine what — if anything — deserves to be remembered permanently.
 *
 * What gets stored:
 *   DECISION   — a significant choice was made (deployed, delegated, escalated)
 *   EXPERIENCE — a task was completed or failed; the outcome is worth remembering
 *   PREFERENCE — a pattern emerged from how work was handled
 *   PROCEDURE  — a step-by-step approach that worked well
 *   FAILURE    — what went wrong and why (so it isn't repeated)
 *
 * What does NOT get stored:
 *   - Routine read operations with no meaningful outcome
 *   - Duplicate information already in memory
 *   - Intermediate planning steps
 *   - Transient tool call results
 *
 * Memory is scoped per Clone and per Company.
 * A Clone CANNOT read another Clone's memory without explicit permission.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryConnector = void 0;
const database_1 = require("@clone/database");
class MemoryConnector {
    /**
     * Analyse a completed execution and persist noteworthy memories.
     */
    async extractAndStore(input) {
        const memories = this.extractMemories(input);
        const stored = [];
        let skipped = 0;
        for (const memory of memories) {
            // Skip if we already have a memory with this key for this Clone
            const existing = await database_1.prisma.employeeMemory.findMany({
                where: {
                    companyId: input.companyId,
                    employeeId: input.cloneId,
                    key: memory.key,
                },
                take: 1,
            });
            if (existing.length > 0) {
                skipped++;
                continue;
            }
            try {
                const record = await database_1.prisma.employeeMemory.create({
                    data: {
                        companyId: input.companyId,
                        employeeId: input.cloneId,
                        scope: "EMPLOYEE",
                        key: memory.key,
                        content: memory.content,
                        confidence: memory.confidence,
                        source: memory.source,
                    },
                });
                stored.push({ id: record.id, key: memory.key, category: memory.category });
            }
            catch {
                skipped++;
            }
        }
        return { stored: stored.length, skipped, memories: stored };
    }
    /**
     * Extract candidate memories from an execution record.
     * This is deterministic rule-based extraction — not LLM-dependent.
     */
    extractMemories(input) {
        const memories = [];
        const steps = input.stepLog || [];
        // ── EXPERIENCE: completed execution ────────────────────────────────────
        if (input.status === "COMPLETED") {
            const delegatedStep = steps.find((s) => s.toolCall?.toolName === "delegation.create_task");
            if (delegatedStep) {
                memories.push({
                    key: `delegation:${input.triggerSource}`,
                    content: `When triggered by "${input.triggerSource}", delegated work to a team member. This is an effective pattern for this event type.`,
                    category: "PROCEDURE",
                    confidence: 0.85,
                    source: `execution:${input.executionId}`,
                });
            }
            memories.push({
                key: `completed:${input.triggerSource}:${new Date().toISOString().slice(0, 10)}`,
                content: `Successfully handled trigger "${input.triggerSource}" on ${new Date().toISOString().slice(0, 10)}.`,
                category: "EXPERIENCE",
                confidence: 0.7,
                source: `execution:${input.executionId}`,
            });
        }
        // ── FAILURE: failed execution ───────────────────────────────────────────
        if (input.status === "FAILED" && input.error) {
            memories.push({
                key: `failure:${input.triggerSource}:${input.error.slice(0, 40).replace(/\s+/g, "_")}`,
                content: `Failed to handle "${input.triggerSource}". Error: ${input.error}. This failure pattern should be considered in future executions.`,
                category: "FAILURE",
                confidence: 0.9,
                source: `execution:${input.executionId}`,
            });
        }
        // ── DECISION: approval was required ────────────────────────────────────
        const approvalStep = steps.find((s) => s.state === "WAITING_FOR_APPROVAL");
        if (approvalStep) {
            memories.push({
                key: `approval_required:${approvalStep.toolCall?.toolName || input.triggerSource}`,
                content: `Action "${approvalStep.toolCall?.toolName || "unknown"}" required human approval when handling "${input.triggerSource}". Remember to request approval proactively.`,
                category: "DECISION",
                confidence: 0.95,
                source: `execution:${input.executionId}`,
            });
        }
        // ── PROCEDURE: multi-step executions that worked ────────────────────────
        if (input.status === "COMPLETED" && steps.length >= 4) {
            const actionNames = steps
                .filter((s) => s.toolCall?.toolName)
                .map((s) => s.toolCall.toolName)
                .join(" → ");
            if (actionNames) {
                memories.push({
                    key: `procedure:${input.triggerSource}`,
                    content: `Effective procedure for "${input.triggerSource}": ${actionNames}`,
                    category: "PROCEDURE",
                    confidence: 0.8,
                    source: `execution:${input.executionId}`,
                });
            }
        }
        return memories;
    }
    /**
     * Store a memory record directly (bypasses extraction logic).
     * Used for explicit "remember this" calls from the engine.
     */
    async storeMemory(input) {
        return database_1.prisma.employeeMemory.create({
            data: {
                companyId: input.companyId,
                employeeId: input.cloneId,
                scope: "EMPLOYEE",
                key: input.key,
                content: input.content,
                confidence: input.confidence ?? 1.0,
                source: input.source || "manual",
            },
        });
    }
    /**
     * Load relevant memories for an execution context.
     * Searches by Clone + company; returns most recent records matching the query.
     */
    async loadRelevantMemories(input) {
        const memories = await database_1.prisma.employeeMemory.findMany({
            where: {
                companyId: input.companyId,
                employeeId: input.cloneId,
            },
            take: input.limit || 20,
        });
        // Simple keyword relevance filter (no vector search required)
        const queryLower = input.query.toLowerCase();
        const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 3);
        return memories
            .filter((m) => {
            const text = `${m.key} ${m.content}`.toLowerCase();
            return queryTokens.some((token) => text.includes(token));
        })
            .slice(0, input.limit || 10);
    }
}
exports.MemoryConnector = MemoryConnector;
//# sourceMappingURL=memory-connector.js.map