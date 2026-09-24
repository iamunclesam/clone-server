"use strict";
/**
 * Runtime Compiler
 *
 * Takes a Clone's full identity, responsibilities, integrations, permissions,
 * authority, and team and produces a CompiledRuntime — the deterministic
 * specification of what this Clone should react to, what it can do, and when
 * it should run.
 *
 * This is the heart of the "permission-aware organizational runtime" principle:
 * a Clone's runtime is DERIVED, never hardcoded.
 *
 * Compilation steps:
 *   1. Load Clone identity from DB
 *   2. Load connected integrations (only live, CONNECTED accounts)
 *   3. Match events by integration + identity relevance keywords
 *   4. Derive available actions from permissions (read-only vs. write)
 *   5. Generate schedules from role + responsibilities + integrations
 *   6. Resolve delegation targets from team
 *   7. Build approval requirements
 *   8. Persist to CompiledRuntimeState + RuntimeTrigger + RuntimeSchedule + RuntimeAction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME_INTEGRATIONS = exports.RuntimeCompiler = void 0;
exports.compileRuntime = compileRuntime;
exports.buildIdentityText = buildIdentityText;
exports.generateSchedules = generateSchedules;
const integration_framework_1 = require("@clone/integration-framework");
const database_1 = require("@clone/database");
// ─── Identity helpers ─────────────────────────────────────────────────────────
/**
 * Build a single lowercase string combining role + name + responsibilities.
 * This is what relevance keywords are matched against.
 */
function buildIdentityText(identity) {
    return [
        identity.role,
        identity.name,
        identity.responsibilities,
    ]
        .join(" ")
        .toLowerCase();
}
// ─── Permission helpers ───────────────────────────────────────────────────────
function providerOf(toolName) {
    if (!toolName)
        return "";
    const str = typeof toolName === "string" ? toolName : (toolName.toolName || toolName.id || toolName.name || String(toolName));
    return str.includes(".") ? str.split(".")[0] : str;
}
/**
 * Find the most specific permission for a given action.
 * Exact match (provider.action) wins over wildcard (provider).
 */
function matchPermission(permissions, actionId) {
    return (permissions.find((p) => p.toolName === actionId) ??
        permissions.find((p) => p.toolName === providerOf(actionId)));
}
// ─── Schedule generation ──────────────────────────────────────────────────────
function nextWeekdayHour(hour, targetDay) {
    const now = new Date();
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(hour);
    // if that time is already past today, move to tomorrow
    if (d <= now)
        d.setDate(d.getDate() + 1);
    // if a specific weekday is needed, keep advancing
    if (targetDay !== undefined) {
        while (d.getDay() !== targetDay)
            d.setDate(d.getDate() + 1);
    }
    return d;
}
/**
 * Generate default schedules for a Clone based on its role + live integrations.
 * Schedules are DEFAULTS — they are only created when the relevant integration
 * is live AND the Clone's role matches.
 */
function generateSchedules(identityText, liveProviders) {
    const schedules = [];
    const has = (provider) => liveProviders.includes(provider);
    // ── Engineering leadership (CTO, tech lead, architect, engineer) ──────────
    if (has("github") &&
        (identityText.includes("cto") ||
            identityText.includes("tech lead") ||
            identityText.includes("architect") ||
            identityText.includes("engineering"))) {
        schedules.push({
            kind: "CRON",
            name: "Daily engineering briefing",
            taskType: "daily_briefing",
            cronExpression: "0 8 * * 1-5",
            timezone: "UTC",
            taskPayload: { source: "github", scope: "engineering" },
            nextRunAt: nextWeekdayHour(8),
        });
        schedules.push({
            kind: "CRON",
            name: "Engineering task health check",
            taskType: "task_health_check",
            cronExpression: "0 9 * * 1-5",
            timezone: "UTC",
            taskPayload: { scope: "engineering" },
            nextRunAt: nextWeekdayHour(9),
        });
        schedules.push({
            kind: "CRON",
            name: "End-of-day engineering status",
            taskType: "eod_status",
            cronExpression: "0 17 * * 1-5",
            timezone: "UTC",
            taskPayload: { scope: "engineering" },
            nextRunAt: nextWeekdayHour(17),
        });
    }
    if (has("github") &&
        (identityText.includes("cto") || identityText.includes("tech lead"))) {
        schedules.push({
            kind: "CRON",
            name: "Weekly technical debt review",
            taskType: "tech_debt_review",
            cronExpression: "0 14 * * 5", // Friday 14:00
            timezone: "UTC",
            taskPayload: { scope: "engineering" },
            nextRunAt: nextWeekdayHour(14, 5),
        });
    }
    // ── Backend/Frontend/QA engineers ──────────────────────────────────────────
    if (identityText.includes("backend") ||
        identityText.includes("frontend") ||
        identityText.includes("engineer") ||
        identityText.includes("qa") ||
        identityText.includes("developer")) {
        schedules.push({
            kind: "CRON",
            name: "Morning assigned-task review",
            taskType: "assigned_task_review",
            cronExpression: "0 9 * * 1-5",
            timezone: "UTC",
            taskPayload: {},
            nextRunAt: nextWeekdayHour(9),
        });
        schedules.push({
            kind: "CRON",
            name: "End-of-day task status update",
            taskType: "task_status_update",
            cronExpression: "0 17 * * 1-5",
            timezone: "UTC",
            taskPayload: {},
            nextRunAt: nextWeekdayHour(17),
        });
    }
    // ── DevOps / SRE ──────────────────────────────────────────────────────────
    if (has("sentry") &&
        (identityText.includes("devops") ||
            identityText.includes("sre") ||
            identityText.includes("infrastructure"))) {
        schedules.push({
            kind: "INTERVAL",
            name: "Production health monitor",
            taskType: "production_health",
            intervalMs: 15 * 60 * 1000, // every 15 minutes
            taskPayload: { severity: "CRITICAL" },
            nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
        });
    }
    // ── Marketing / CMO ───────────────────────────────────────────────────────
    if (identityText.includes("cmo") ||
        identityText.includes("marketing") ||
        identityText.includes("growth")) {
        schedules.push({
            kind: "CRON",
            name: "Morning marketing briefing",
            taskType: "daily_briefing",
            cronExpression: "30 8 * * 1-5",
            timezone: "UTC",
            taskPayload: { scope: "marketing" },
            nextRunAt: nextWeekdayHour(8),
        });
        if (has("slack") || has("hubspot")) {
            schedules.push({
                kind: "CRON",
                name: "Social / campaign monitoring",
                taskType: "campaign_monitor",
                cronExpression: "0 12 * * 1-5",
                timezone: "UTC",
                taskPayload: {},
                nextRunAt: nextWeekdayHour(12),
            });
        }
        schedules.push({
            kind: "CRON",
            name: "End-of-day campaign review",
            taskType: "campaign_review",
            cronExpression: "0 17 * * 1-5",
            timezone: "UTC",
            taskPayload: { scope: "marketing" },
            nextRunAt: nextWeekdayHour(17),
        });
        schedules.push({
            kind: "CRON",
            name: "Weekly growth report",
            taskType: "weekly_growth_report",
            cronExpression: "0 16 * * 5", // Friday 16:00
            timezone: "UTC",
            taskPayload: {},
            nextRunAt: nextWeekdayHour(16, 5),
        });
    }
    // ── Support / Ops ─────────────────────────────────────────────────────────
    if (has("gmail") &&
        (identityText.includes("support") || identityText.includes("ops"))) {
        schedules.push({
            kind: "INTERVAL",
            name: "Inbox monitoring",
            taskType: "inbox_monitor",
            intervalMs: 30 * 60 * 1000, // every 30 minutes
            taskPayload: { source: "gmail" },
            nextRunAt: new Date(Date.now() + 30 * 60 * 1000),
        });
    }
    // ── Calendar watch (any Clone with calendar) ───────────────────────────────
    if (has("calendar")) {
        schedules.push({
            kind: "INTERVAL",
            name: "Calendar event watch",
            taskType: "calendar_watch",
            intervalMs: 30 * 60 * 1000,
            taskPayload: { lookaheadMinutes: 15 },
            nextRunAt: new Date(Date.now() + 30 * 60 * 1000),
        });
    }
    // ── Commitment monitor (any Clone with active commitments) ─────────────────
    // Always added — the CommitmentMonitor uses this schedule
    schedules.push({
        kind: "INTERVAL",
        name: "Commitment deadline monitor",
        taskType: "commitment_check",
        intervalMs: 15 * 60 * 1000, // every 15 minutes
        taskPayload: {},
        nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return schedules;
}
// ─── RuntimeCompiler ─────────────────────────────────────────────────────────
class RuntimeCompiler {
    /**
     * Compile a Clone's full runtime context into a CompiledRuntime.
     * This is the pure in-memory version — used by tests and the engine's
     * internal fast-path. Does NOT write to DB.
     */
    compile(companyId, ctx, connectedProviders) {
        const liveProviders = ctx.integrations.filter((p) => connectedProviders.includes(p));
        const identityText = buildIdentityText(ctx.identity);
        // ── 1. Relevant Events ──────────────────────────────────────────────────
        const relevantEventDefs = (0, integration_framework_1.findRelevantEvents)(liveProviders, identityText);
        const relevantEvents = [...new Set(relevantEventDefs.map((e) => e.id))];
        // ── 2. Available Actions + Approval Requirements ────────────────────────
        const availableActions = [];
        const approvalRequirements = [];
        for (const perm of ctx.permissions) {
            const provider = providerOf(perm.toolName);
            if (!liveProviders.includes(provider))
                continue;
            if (perm.toolName.includes(".")) {
                // Specific action permission
                availableActions.push(perm.toolName);
                const action = (0, integration_framework_1.listRuntimeActions)(provider).find((a) => a.id === perm.toolName);
                const needsApproval = action?.requiresApproval === true || perm.requiresApproval === true;
                if (needsApproval)
                    approvalRequirements.push(perm.toolName);
            }
            else {
                // Provider-level permission — expand to all actions
                for (const action of (0, integration_framework_1.listRuntimeActions)(provider)) {
                    // Enforce read-only restriction
                    if (action.write && perm.writeAccess === false)
                        continue;
                    availableActions.push(action.id);
                    const needsApproval = action.requiresApproval === true || perm.requiresApproval === true;
                    if (needsApproval)
                        approvalRequirements.push(action.id);
                }
            }
        }
        // ── 3. Schedules ────────────────────────────────────────────────────────
        const schedules = generateSchedules(identityText, liveProviders);
        // ── 4. Delegation Targets ───────────────────────────────────────────────
        const delegationTargets = [];
        if (ctx.authority.canDelegate) {
            for (const memberId of ctx.team.memberIds) {
                if (!memberId || memberId === ctx.identity.id)
                    continue;
                delegationTargets.push({
                    employeeId: memberId,
                    name: "", // populated by compileRuntime() which has DB access
                    role: "",
                    reason: "Team report — lead may delegate relevant work.",
                });
            }
        }
        return {
            cloneId: ctx.identity.id,
            companyId,
            relevantEvents: [...new Set(relevantEvents)],
            availableActions: [...new Set(availableActions)],
            approvalRequirements: [...new Set(approvalRequirements)],
            delegationTargets,
            schedules,
            compiledAt: new Date(),
        };
    }
    /**
     * isEventRelevant — fast check using a pre-compiled runtime.
     */
    isEventRelevant(compiled, eventId) {
        return compiled.relevantEvents.includes(eventId);
    }
    /**
     * canPerformAction — check if an action is in the compiled runtime.
     */
    canPerformAction(compiled, actionId) {
        return compiled.availableActions.includes(actionId);
    }
    /**
     * requiresApproval — check if an action requires human approval.
     */
    requiresApproval(compiled, actionId) {
        return compiled.approvalRequirements.includes(actionId);
    }
}
exports.RuntimeCompiler = RuntimeCompiler;
// ─── DB-backed compile ────────────────────────────────────────────────────────
/**
 * compileRuntime(cloneId, companyId)
 *
 * The full DB-backed compilation pipeline:
 *   1. Load Clone from DB
 *   2. Load team members for delegation targets
 *   3. Load connected accounts for live providers
 *   4. Build CloneRuntimeContext
 *   5. Compile to CompiledRuntime
 *   6. Persist: CompiledRuntimeState, RuntimeTriggers, RuntimeSchedules, RuntimeActions
 *
 * Returns the compiled runtime.
 */
async function compileRuntime(cloneId, companyId) {
    // ── 1. Load Clone ───────────────────────────────────────────────────────
    const clone = await database_1.prisma.aIEmployee.findFirst({
        where: { id: cloneId, companyId },
    });
    if (!clone) {
        throw new Error(`Clone ${cloneId} not found in company ${companyId}`);
    }
    // ── 2. Load team + members ──────────────────────────────────────────────
    let teamMemberIds = [];
    let teamMemberDetails = [];
    let teamId;
    let teamName;
    let leadId;
    if (clone.teamId) {
        const team = await database_1.prisma.team.findUnique({ where: { id: clone.teamId } });
        if (team) {
            teamId = team.id;
            teamName = team.name;
            leadId = team.leadEmployeeId;
        }
        const teamMembers = await database_1.prisma.aIEmployee.findMany({
            where: { companyId, teamId: clone.teamId },
        });
        teamMemberIds = teamMembers.map((m) => m.id);
        teamMemberDetails = teamMembers.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
        }));
    }
    // ── 3. Load connected accounts ──────────────────────────────────────────
    const connectedAccounts = await database_1.prisma.connectedAccount.findMany({
        where: { companyId, status: "CONNECTED" },
    });
    const connectedProviders = connectedAccounts.map((a) => a.provider);
    const connectedIntegrations = connectedAccounts.map((a) => ({
        provider: a.provider,
        connectionId: a.id,
        accountName: a.accountName,
        scopes: a.scopes,
    }));
    // ── 4. Build CloneRuntimeContext ────────────────────────────────────────
    // Determine authority level
    const isLead = leadId === cloneId;
    const authorityLevel = isLead ? "LEAD" : "MEMBER";
    const ctx = {
        identity: {
            id: clone.id,
            name: clone.name,
            role: clone.role,
            personality: clone.personality,
            responsibilities: clone.systemInstructions || clone.shortDescription || clone.role,
            status: clone.status,
        },
        responsibilities: [], // reserved for future structured responsibilities
        integrations: connectedProviders,
        connectedIntegrations,
        permissions: (clone.permissions || []).map((p) => ({
            toolName: p.toolName,
            requiresApproval: p.requiresApproval,
            writeAccess: p.writeAccess,
        })),
        authority: {
            level: authorityLevel,
            canDelegate: authorityLevel === "LEAD",
            canApprove: authorityLevel === "LEAD",
            reportsTo: leadId && leadId !== cloneId ? leadId : undefined,
        },
        team: {
            id: teamId,
            name: teamName,
            leadId,
            memberIds: teamMemberIds,
            humanOwners: [],
        },
        commitments: [],
    };
    // ── 5. Compile ──────────────────────────────────────────────────────────
    const compiler = new RuntimeCompiler();
    const compiled = compiler.compile(companyId, ctx, connectedProviders);
    // Populate delegation target names/roles from the loaded members
    for (const target of compiled.delegationTargets) {
        const member = teamMemberDetails.find((m) => m.id === target.employeeId);
        if (member) {
            target.name = member.name;
            target.role = member.role;
        }
    }
    // ── 6. Persist CompiledRuntimeState ────────────────────────────────────
    await database_1.prisma.compiledRuntimeState.upsert({
        where: { cloneId },
        create: {
            companyId,
            cloneId,
            relevantEvents: compiled.relevantEvents,
            availableActions: compiled.availableActions,
            approvalRequirements: compiled.approvalRequirements,
            delegationTargets: compiled.delegationTargets,
            scheduleNames: compiled.schedules.map((s) => s.name),
            connectedProviders,
            compiledAt: compiled.compiledAt,
        },
        update: {
            relevantEvents: compiled.relevantEvents,
            availableActions: compiled.availableActions,
            approvalRequirements: compiled.approvalRequirements,
            delegationTargets: compiled.delegationTargets,
            scheduleNames: compiled.schedules.map((s) => s.name),
            connectedProviders,
            compiledAt: compiled.compiledAt,
        },
    });
    // ── 7. Persist RuntimeTriggers ─────────────────────────────────────────
    // Delete old triggers for this clone, then recreate from compiled events
    await database_1.prisma.runtimeTrigger.deleteMany({ where: { cloneId, companyId } });
    if (compiled.relevantEvents.length > 0) {
        const triggerDocs = compiled.relevantEvents.map((eventId) => {
            const str = typeof eventId === "string" ? eventId : (eventId?.id || eventId?.eventId || String(eventId || ""));
            const [source, ...rest] = str.split(".");
            return {
                companyId,
                cloneId,
                name: `React to ${eventId}`,
                triggerType: "EVENT",
                source,
                eventType: rest.join("."),
                enabled: true,
                priority: 5,
            };
        });
        await database_1.prisma.runtimeTrigger.createMany({ data: triggerDocs });
    }
    // ── 8. Persist RuntimeSchedules ────────────────────────────────────────
    await database_1.prisma.runtimeSchedule.deleteMany({ where: { cloneId, companyId } });
    if (compiled.schedules.length > 0) {
        const scheduleDocs = compiled.schedules.map((s) => ({
            companyId,
            cloneId,
            name: s.name,
            triggerType: s.kind,
            cronExpression: s.cronExpression,
            intervalMs: s.intervalMs,
            timezone: s.timezone || "UTC",
            taskType: s.taskType,
            taskPayload: s.taskPayload || {},
            enabled: true,
            nextRunAt: s.nextRunAt || new Date(Date.now() + 60_000),
        }));
        await database_1.prisma.runtimeSchedule.createMany({ data: scheduleDocs });
    }
    // ── 9. Persist RuntimeActions ──────────────────────────────────────────
    await database_1.prisma.runtimeAction.deleteMany({ where: { cloneId, companyId } });
    if (compiled.availableActions.length > 0) {
        const actionDocs = compiled.availableActions.map((actionId) => {
            const str = typeof actionId === "string" ? actionId : (actionId?.id || actionId?.toolName || String(actionId || ""));
            const manifest = (0, integration_framework_1.getRuntimeManifest)(str.includes(".") ? str.split(".")[0] : str);
            const actionDef = manifest?.actions.find((a) => a.id === str);
            return {
                companyId,
                cloneId,
                name: actionDef?.name || actionId,
                description: actionDef?.description,
                toolName: actionId,
                actionType: "integration",
                riskLevel: actionDef?.riskLevel || "LOW",
                requiresApproval: compiled.approvalRequirements.includes(actionId),
                enabled: true,
            };
        });
        await database_1.prisma.runtimeAction.createMany({ data: actionDocs });
    }
    return compiled;
}
var integration_framework_2 = require("@clone/integration-framework");
Object.defineProperty(exports, "RUNTIME_INTEGRATIONS", { enumerable: true, get: function () { return integration_framework_2.RUNTIME_INTEGRATIONS; } });
//# sourceMappingURL=compiler.js.map