"use strict";
/**
 * Runtime Engine
 *
 * The top-level orchestrator that wires every runtime component together.
 * This is the single entry point for all runtime operations.
 *
 * Responsibilities:
 *   - Start/stop the scheduler
 *   - Route inbound events
 *   - Execute queued executions (wake → plan → authority → execute → verify → memory)
 *   - Handle delegation
 *   - Monitor commitments
 *   - Route escalations
 *   - Build the dashboard state
 *
 * Execution lifecycle:
 *   QUEUED → PLANNING → WAITING_FOR_AUTHORITY? → WAITING_FOR_APPROVAL? →
 *   EXECUTING → VERIFYING → COMPLETED
 *                        ↓ on error
 *                      FAILED → retry → FAILED × 2 → ESCALATE
 *
 * Integration with AuthorityGate:
 *   Every proposed action passes through AuthorityGate before execution.
 *   The LLM (or rule engine) proposes an action; the gate decides ALLOW /
 *   APPROVAL / DENY. The engine acts on that decision — never the LLM directly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEngine = void 0;
exports.getRuntimeEngine = getRuntimeEngine;
const database_1 = require("@clone/database");
const integration_framework_1 = require("@clone/integration-framework");
const compiler_1 = require("./compiler");
const scheduler_1 = require("./scheduler");
const event_router_1 = require("./event-router");
const authority_1 = require("./authority");
const delegation_1 = require("./delegation");
const commitments_1 = require("./commitments");
const escalation_1 = require("./escalation");
const memory_connector_1 = require("./memory-connector");
const llm_client_1 = require("./llm-client");
// ─── Engine ───────────────────────────────────────────────────────────────────
class RuntimeEngine {
    scheduler;
    router;
    authority;
    delegation;
    commitments;
    escalation;
    memory;
    registry;
    started = false;
    constructor() {
        this.router = new event_router_1.EventRouter();
        this.authority = new authority_1.AuthorityGate();
        this.delegation = new delegation_1.DelegationEngine();
        this.commitments = new commitments_1.CommitmentMonitor();
        this.escalation = new escalation_1.EscalationEngine();
        this.memory = new memory_connector_1.MemoryConnector();
        this.registry = integration_framework_1.IntegrationRegistry.getInstance();
        // Scheduler fires each job back into the engine
        this.scheduler = new scheduler_1.RuntimeScheduler((job) => this.handleScheduledJob(job));
    }
    // ── Lifecycle ───────────────────────────────────────────────────────────────
    start() {
        if (this.started)
            return;
        this.started = true;
        this.scheduler.start();
        console.log("[RuntimeEngine] Started.");
        // Auto-compile every active clone so they wake up immediately.
        // Runs 5s after startup to allow DB to fully connect.
        setTimeout(() => this.bootstrapAllClones(), 5_000);
    }
    /**
     * Compile runtimes for every active clone across all companies.
     * This is what makes clones "always awake" — their schedules and triggers
     * are registered in DB so the scheduler can fire them.
     */
    async bootstrapAllClones() {
        try {
            const clones = await database_1.prisma.aIEmployee.findMany({
                where: { status: { $ne: "PAUSED" } },
            });
            for (const clone of clones) {
                (0, compiler_1.compileRuntime)(clone.id, clone.companyId).catch(() => { });
            }
            console.log(`[RuntimeEngine] Bootstrapped ${clones.length} clone runtimes.`);
        }
        catch {
            /* DB not ready yet — scheduler poll will retry */
        }
    }
    stop() {
        this.scheduler.stop();
        this.started = false;
        console.log("[RuntimeEngine] Stopped.");
    }
    // ── Compile Runtime for a Clone ─────────────────────────────────────────────
    async compileCloneRuntime(cloneId, companyId) {
        return (0, compiler_1.compileRuntime)(cloneId, companyId);
    }
    // ── Inbound Event Routing ───────────────────────────────────────────────────
    async ingestEvent(event) {
        const result = await this.router.routeEvent(event);
        // Process each queued execution immediately (fire-and-forget)
        for (const routed of result.routedTo) {
            this.executeById(routed.executionId, event.companyId).catch((err) => {
                console.error(`[RuntimeEngine] Execution ${routed.executionId} failed:`, err?.message);
            });
        }
        return result;
    }
    // ── Scheduled Job Handler ───────────────────────────────────────────────────
    async handleScheduledJob(job) {
        console.log(`[RuntimeEngine] Scheduled job fired: ${job.taskType} for clone ${job.cloneId}`);
        // Handle commitment monitor specially — it scans, not creates an execution
        if (job.taskType === "commitment_check") {
            await this.commitments.scan(job.companyId);
            return;
        }
        // For all other task types, create an execution and run it
        const execution = await database_1.prisma.runtimeExecution.create({
            data: {
                companyId: job.companyId,
                cloneId: job.cloneId,
                status: "QUEUED",
                triggerSource: `cron:${job.taskType}`,
                input: {
                    taskType: job.taskType,
                    taskPayload: job.taskPayload,
                    scheduleId: job.scheduleId,
                    scheduleName: job.scheduleName,
                },
                startedAt: new Date(),
                stepLog: [
                    {
                        step: 1,
                        state: "QUEUED",
                        timestamp: new Date(),
                        details: `Scheduled job "${job.scheduleName}" (${job.taskType}) triggered.`,
                    },
                ],
            },
        });
        await this.executeById(execution.id, job.companyId);
    }
    // ── Wake a Clone ────────────────────────────────────────────────────────────
    async wakeClone(input) {
        const execution = await database_1.prisma.runtimeExecution.create({
            data: {
                companyId: input.companyId,
                cloneId: input.cloneId,
                status: "QUEUED",
                triggerSource: input.trigger.eventId || input.trigger.kind,
                input: {
                    reason: input.reason,
                    trigger: input.trigger,
                    context: input.context || {},
                },
                startedAt: new Date(),
                stepLog: [
                    {
                        step: 1,
                        state: "QUEUED",
                        timestamp: new Date(),
                        details: `Clone woken: ${input.reason}`,
                    },
                ],
            },
        });
        return this.executeById(execution.id, input.companyId);
    }
    // ── Execute a Queued Execution ──────────────────────────────────────────────
    async executeById(executionId, companyId) {
        const execution = await database_1.prisma.runtimeExecution.findFirst({
            where: { id: executionId, companyId },
        });
        if (!execution) {
            return {
                status: "FAILED",
                error: `Execution ${executionId} not found`,
                stepLog: [],
            };
        }
        return this.runExecution(execution, companyId);
    }
    // ── Core Execution Pipeline ─────────────────────────────────────────────────
    async runExecution(execution, companyId) {
        const cloneId = execution.cloneId;
        const steps = Array.isArray(execution.stepLog)
            ? [...execution.stepLog]
            : [];
        const addStep = async (state, details, toolCall) => {
            const step = {
                step: steps.length + 1,
                state: state,
                timestamp: new Date(),
                details,
                toolCall,
            };
            steps.push(step);
            await database_1.prisma.runtimeExecution.update({
                where: { id: execution.id },
                data: { status: state, stepLog: steps },
            });
        };
        try {
            // ── PLANNING ───────────────────────────────────────────────────────────
            await addStep("PLANNING", "Loading Clone context and compiled runtime.");
            const clone = await database_1.prisma.aIEmployee.findFirst({
                where: { id: cloneId, companyId },
            });
            if (!clone) {
                await addStep("FAILED", `Clone ${cloneId} not found.`);
                return { status: "FAILED", error: "Clone not found", stepLog: steps };
            }
            // Mark clone as WORKING
            await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "WORKING" } }).catch(() => { });
            const compiled = await database_1.prisma.compiledRuntimeState.findFirst({ where: { cloneId, companyId } });
            const connectedAccounts = await database_1.prisma.connectedAccount.findMany({ where: { companyId, status: "CONNECTED" } });
            const connectedProviders = connectedAccounts.map((a) => a.provider);
            // ── FIX E: Correct authority — check if this clone is a team lead ──────
            let isLead = false;
            let teamId;
            if (clone.teamId) {
                const team = await database_1.prisma.team.findUnique({ where: { id: clone.teamId } });
                if (team?.leadEmployeeId?.toString() === clone.id)
                    isLead = true;
                teamId = team?.id;
            }
            // ── FIX F: Only use THIS clone's assigned providers, not all workspace providers
            const clonePermProviders = new Set((clone.permissions || []).map((p) => {
                const name = typeof p === "string" ? p : (p?.toolName || p?.id || p?.name || String(p || ""));
                return name.includes(".") ? name.split(".")[0] : name;
            }));
            const cloneConnectedProviders = connectedProviders.filter((p) => clonePermProviders.has(p));
            const triggerSource = execution.triggerSource || execution.input?.trigger?.eventId || "manual";
            const memories = await this.memory.loadRelevantMemories({ companyId, cloneId, query: triggerSource, limit: 5 });
            await addStep("PLANNING", `"${clone.name}" (${clone.role}) — ` +
                `providers: [${cloneConnectedProviders.join(", ")}], ` +
                `authority: ${isLead ? "LEAD" : "MEMBER"}, ` +
                `memories: ${memories.length}, actions: ${compiled?.availableActions?.length ?? 0}.`);
            const ctx = {
                identity: {
                    id: clone.id, name: clone.name, role: clone.role,
                    personality: clone.personality,
                    responsibilities: clone.systemInstructions || clone.role,
                    status: clone.status,
                },
                integrations: cloneConnectedProviders, // FIX F
                connectedIntegrations: connectedAccounts
                    .filter((a) => clonePermProviders.has(a.provider))
                    .map((a) => ({ provider: a.provider, connectionId: a.id, accountName: a.accountName, scopes: a.scopes })),
                permissions: (clone.permissions || []).map((p) => ({
                    toolName: p.toolName, requiresApproval: p.requiresApproval, writeAccess: p.writeAccess,
                })),
                authority: { level: isLead ? "LEAD" : "MEMBER", canDelegate: isLead, canApprove: isLead }, // FIX E
                team: { memberIds: [], humanOwners: [] },
                commitments: [],
            };
            // ── AUTHORITY CHECK ────────────────────────────────────────────────────
            await addStep("WAITING_FOR_AUTHORITY", "Determining action plan.");
            const proposedAction = this.resolveActionFromTrigger(triggerSource, cloneConnectedProviders, compiled);
            // ── FIX A: Even with no integration action, use LLM to generate output ─
            // Clones always think — even without a connected app they can reason and communicate
            const memoryContext = memories.map((m) => `- ${m.key}: ${m.content}`).join("\n");
            const taskType = triggerSource.startsWith("cron:") ? triggerSource.slice(5) : triggerSource;
            if (!proposedAction) {
                // No integration action — but clone still thinks and posts to channel
                await addStep("EXECUTING", `No integration action available. Generating ${taskType} response via LLM.`);
                const llmResult = await (0, llm_client_1.callLLM)({
                    preferredModel: clone.llmModel || "mistral-small-latest",
                    messages: [
                        { role: "system", content: (0, llm_client_1.buildCloneSystemPrompt)(clone) },
                        {
                            role: "user",
                            content: `Task: ${taskType}. ` +
                                (memoryContext ? `Context from memory:\n${memoryContext}\n\n` : "") +
                                `Generate a brief team update (2–4 sentences) appropriate for this task.`,
                        },
                    ],
                    temperature: 0.4,
                    maxTokens: 300,
                });
                if (llmResult.success) {
                    await this.postToTeamChannel(companyId, clone, teamId, llmResult.content, triggerSource);
                    await addStep("COMPLETED", `LLM response generated and posted to team channel.`);
                }
                else {
                    await addStep("COMPLETED", `Execution acknowledged (LLM unavailable: ${llmResult.error}).`);
                }
                await this.finaliseExecution(execution.id, "COMPLETED", steps, { observed: true, trigger: triggerSource });
                await this.memory.extractAndStore({ companyId, cloneId, executionId: execution.id, triggerSource, status: "COMPLETED", stepLog: steps });
                await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
                return { status: "COMPLETED", stepLog: steps };
            }
            await addStep("WAITING_FOR_AUTHORITY", `Proposed action: "${proposedAction}". Running authority check.`);
            const gate = this.authority.evaluate({ context: ctx, actionId: proposedAction, connectedProviders: cloneConnectedProviders });
            if (gate.decision === "DENY") {
                await addStep("FAILED", `Authority denied: ${gate.reason}`);
                await this.finaliseExecution(execution.id, "FAILED", steps, null, gate.reason);
                await this.escalation.escalate({ companyId, cloneId, executionId: execution.id, reason: `Action "${proposedAction}" was denied: ${gate.reason}`, severity: "MEDIUM" });
                await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
                return { status: "FAILED", error: gate.reason, stepLog: steps };
            }
            if (gate.decision === "APPROVAL") {
                await addStep("WAITING_FOR_APPROVAL", `Action "${proposedAction}" requires approval. ${gate.reason}`, { toolName: proposedAction, args: { executionId: execution.id } });
                const approval = await database_1.prisma.approvalRequest.create({
                    data: {
                        companyId, employeeId: cloneId,
                        actionName: proposedAction, toolName: proposedAction,
                        proposedParams: JSON.stringify({ executionId: execution.id, trigger: triggerSource }),
                        riskLevel: this.riskLevelForAction(proposedAction),
                        riskReason: gate.reason, status: "PENDING",
                    },
                });
                await database_1.prisma.runtimeExecution.update({ where: { id: execution.id }, data: { status: "WAITING_FOR_APPROVAL", approvalRequestId: approval.id, stepLog: steps } });
                await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
                return { status: "WAITING_FOR_APPROVAL", action: proposedAction, approvalRequired: true, approvalRequestId: approval.id, stepLog: steps };
            }
            // ── EXECUTING ──────────────────────────────────────────────────────────
            await addStep("EXECUTING", `Executing "${proposedAction}".`);
            let actionResult = null;
            let actionError;
            try {
                const rawAction = proposedAction;
                const actionStr = typeof rawAction === "string" ? rawAction : (rawAction?.id || rawAction?.toolName || String(rawAction || ""));
                const provider = actionStr.includes(".") ? actionStr.split(".")[0] : actionStr;
                const integrationProvider = this.registry.getProvider(provider);
                if (integrationProvider) {
                    const connectedAccount = connectedAccounts.find((a) => a.provider === provider);
                    const toolResult = await integrationProvider.executeTool({
                        connectionId: connectedAccount?.id || "runtime",
                        toolName: proposedAction,
                        arguments: execution.input || {},
                        employeeId: cloneId,
                        companyId,
                    });
                    actionResult = toolResult?.data;
                    if (!toolResult?.success)
                        actionError = toolResult?.error || "Tool execution failed";
                }
                else {
                    actionResult = { planned: true, action: proposedAction };
                }
            }
            catch (err) {
                actionError = err?.message || "Execution error";
            }
            if (actionError) {
                await addStep("FAILED", `Execution failed: ${actionError}`, { toolName: proposedAction, result: { error: actionError } });
                await this.finaliseExecution(execution.id, "FAILED", steps, null, actionError);
                if (this.escalation.shouldEscalate({ failedAttempts: 1, overdue: false })) {
                    await this.escalation.escalate({ companyId, cloneId, executionId: execution.id, reason: `Execution of "${proposedAction}" failed: ${actionError}`, severity: "HIGH" });
                }
                await this.memory.extractAndStore({ companyId, cloneId, executionId: execution.id, triggerSource, status: "FAILED", error: actionError, stepLog: steps });
                await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
                return { status: "FAILED", action: proposedAction, error: actionError, stepLog: steps };
            }
            await addStep("EXECUTING", `"${proposedAction}" executed successfully.`, { toolName: proposedAction, args: execution.input || {}, result: actionResult });
            // ── VERIFYING ──────────────────────────────────────────────────────────
            await addStep("VERIFYING", `Verifying result of "${proposedAction}".`);
            if (actionResult === null || actionResult === undefined) {
                await addStep("FAILED", "Verification failed — no result returned.");
                await this.finaliseExecution(execution.id, "FAILED", steps, null, "Verification failed");
                await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
                return { status: "FAILED", action: proposedAction, error: "Verification failed", stepLog: steps };
            }
            // ── FIX A: LLM synthesises the action result into a meaningful response ─
            const actionSummaryResult = await (0, llm_client_1.callLLM)({
                preferredModel: clone.llmModel || "mistral-small-latest",
                messages: [
                    { role: "system", content: (0, llm_client_1.buildCloneSystemPrompt)(clone) },
                    {
                        role: "user",
                        content: `You just executed "${proposedAction}" triggered by "${triggerSource}".\n` +
                            `Result summary: ${JSON.stringify(actionResult).slice(0, 600)}\n` +
                            (memoryContext ? `Relevant memory:\n${memoryContext}\n\n` : "") +
                            `Write a brief team update (2–4 sentences) about what you found and what you plan to do next. ` +
                            `If you are a lead and the work requires delegation, say so explicitly.`,
                    },
                ],
                temperature: 0.35,
                maxTokens: 350,
            });
            // ── FIX B: Post LLM response to team channel ───────────────────────────
            if (actionSummaryResult.success) {
                await this.postToTeamChannel(companyId, clone, teamId, actionSummaryResult.content, triggerSource);
                await addStep("VERIFYING", `Response generated and posted to team channel.`);
            }
            // ── FIX C+D: Delegation — if clone is a lead, delegate work to team ────
            if (isLead && compiled?.delegationTargets && compiled.delegationTargets.length > 0) {
                await this.performSmartDelegation(companyId, clone, compiled.delegationTargets, triggerSource, taskType, actionResult, execution.id, teamId);
                await addStep("EXECUTING", `Delegation decisions made for team members.`);
            }
            // ── FIX C: Create commitment for this execution ────────────────────────
            if (taskType !== "commitment_check") {
                await this.commitments.createFromExecution({
                    companyId,
                    cloneId,
                    title: `${taskType.replace(/_/g, " ")} — ${clone.name}`,
                    description: actionSummaryResult.content || triggerSource,
                    sourceExecutionId: execution.id,
                    priority: "MEDIUM",
                }).catch(() => { });
            }
            // ── COMPLETED ──────────────────────────────────────────────────────────
            await addStep("COMPLETED", `Execution complete. Action "${proposedAction}" verified.`);
            await this.finaliseExecution(execution.id, "COMPLETED", steps, actionResult);
            await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
            await this.memory.extractAndStore({ companyId, cloneId, executionId: execution.id, triggerSource, status: "COMPLETED", result: actionResult, stepLog: steps });
            await database_1.prisma.activityLog.create({
                data: { companyId, employeeId: cloneId, actorName: clone.name, action: "EXECUTION_COMPLETED", resource: proposedAction, details: `Trigger: "${triggerSource}" completed.` },
            });
            return { status: "COMPLETED", action: proposedAction, result: actionResult, stepLog: steps };
        }
        catch (err) {
            const errMsg = err?.message || "Unexpected engine error";
            steps.push({ step: steps.length + 1, state: "FAILED", timestamp: new Date(), details: `Unhandled error: ${errMsg}` });
            await this.finaliseExecution(execution.id, "FAILED", steps, null, errMsg);
            await database_1.prisma.aIEmployee.update({ where: { id: cloneId }, data: { status: "ACTIVE" } }).catch(() => { });
            await this.escalation.escalate({ companyId, cloneId, executionId: execution.id, reason: `Engine error: ${errMsg}`, severity: "HIGH" }).catch(() => { });
            return { status: "FAILED", error: errMsg, stepLog: steps };
        }
    }
    // ── FIX B: Post to the clone's team channel ──────────────────────────────
    async postToTeamChannel(companyId, clone, teamId, content, triggerSource) {
        try {
            // Find the team's channel
            let channelQuery = { companyId };
            if (teamId)
                channelQuery.teamId = teamId;
            let channel = await database_1.ChannelModel.findOne(channelQuery).sort({ updatedAt: -1 });
            // If no team channel exists, find any channel for this company
            if (!channel) {
                channel = await database_1.ChannelModel.findOne({ companyId }).sort({ updatedAt: -1 });
            }
            if (!channel)
                return;
            await database_1.ChannelMessageModel.create({
                companyId,
                channelId: channel._id,
                senderId: clone.id || clone._id,
                content,
                messageType: "STATUS_UPDATE",
                mentions: [],
                parentMessageId: null,
            });
            await database_1.ChannelModel.findByIdAndUpdate(channel._id, { updatedAt: new Date() });
        }
        catch (err) {
            // Never crash the execution because of a channel post failure
            console.warn(`[RuntimeEngine] Channel post failed for ${clone.name}: ${err?.message}`);
        }
    }
    // ── FIX D: Smart delegation — lead distributes work to team members ────────
    async performSmartDelegation(companyId, leadClone, delegationTargets, triggerSource, taskType, actionResult, sourceExecutionId, teamId) {
        // Use LLM to decide delegation based on trigger and result
        const delegationPlan = await (0, llm_client_1.callLLM)({
            preferredModel: leadClone.llmModel || "mistral-small-latest",
            messages: [
                { role: "system", content: (0, llm_client_1.buildCloneSystemPrompt)(leadClone) },
                {
                    role: "user",
                    content: `You are the team lead. You just handled "${triggerSource}" (${taskType}).\n` +
                        `Result: ${JSON.stringify(actionResult).slice(0, 400)}\n\n` +
                        `Your team members:\n` +
                        delegationTargets.map((t) => `- ${t.name} (${t.role})`).join("\n") +
                        `\n\nFor each team member that should receive follow-up work, output ONE line:\n` +
                        `DELEGATE: [member name] | [task title] | [objective in one sentence]\n` +
                        `If no delegation is needed, output: NO_DELEGATION`,
                },
            ],
            temperature: 0.3,
            maxTokens: 300,
        });
        if (!delegationPlan.success || delegationPlan.content.includes("NO_DELEGATION"))
            return;
        const lines = delegationPlan.content.split("\n").filter((l) => l.startsWith("DELEGATE:"));
        for (const line of lines) {
            const parts = line.replace("DELEGATE:", "").split("|").map((s) => s.trim());
            if (parts.length < 3)
                continue;
            const [memberName, title, objective] = parts;
            const target = delegationTargets.find((t) => {
                const firstName = (t.name || "").toLowerCase().split(" ")[0] || "";
                return (t.name || "").toLowerCase().includes(memberName.toLowerCase()) ||
                    (firstName && memberName.toLowerCase().includes(firstName));
            });
            if (!target)
                continue;
            await this.delegation.delegate({
                fromCloneId: leadClone.id || leadClone._id?.toString(),
                toCloneId: target.employeeId,
                companyId,
                title,
                objective,
                context: `Delegated by ${leadClone.name} after ${taskType}. Trigger: ${triggerSource}.`,
                expectedOutput: "Update the team channel with your findings.",
                priority: "MEDIUM",
                sourceExecutionId,
            }).catch(() => { });
        }
    }
    // ── Helpers ─────────────────────────────────────────────────────────────────
    async finaliseExecution(executionId, status, steps, result, error) {
        await database_1.prisma.runtimeExecution.update({
            where: { id: executionId },
            data: {
                status,
                result: result ?? null,
                error: error ?? null,
                completedAt: new Date(),
                stepLog: steps,
            },
        });
    }
    /**
     * Derive a proposed action from the trigger source and compiled runtime.
     * Priority: trigger event → compiled available actions → null (observe-only).
     */
    resolveActionFromTrigger(triggerSource, connectedProviders, compiled) {
        // Cron/schedule task types
        if (triggerSource.startsWith("cron:")) {
            const taskType = triggerSource.slice(5);
            if (taskType === "daily_briefing" && connectedProviders.includes("github")) {
                return "github.list_repositories";
            }
            if (taskType === "task_health_check" && connectedProviders.includes("linear")) {
                return "linear.list_issues";
            }
            if (taskType === "inbox_monitor" && connectedProviders.includes("gmail")) {
                return "gmail.read_message";
            }
            if (taskType === "calendar_watch" && connectedProviders.includes("calendar")) {
                return "calendar.read_events";
            }
            if (taskType === "production_health" && connectedProviders.includes("sentry")) {
                return "sentry.list_issues";
            }
            return null;
        }
        // Integration events
        const eventActionMap = {
            "sentry.incident_created": "sentry.get_issue",
            "sentry.error_rate_increased": "sentry.list_issues",
            "github.pr_opened": "github.read_repository",
            "github.pr_review_requested": "github.read_repository",
            "github.ci_failed": "github.read_repository",
            "github.issue_created": "github.read_repository",
            "linear.issue_created": "linear.list_issues",
            "linear.issue_overdue": "linear.update_issue",
            "gmail.message_received": "gmail.read_message",
            "slack.message_received": "slack.read_channel",
            "vercel.deployment_failed": "vercel.list_deployments",
            "calendar.event_starting": "calendar.read_events",
        };
        if (eventActionMap[triggerSource]) {
            const action = eventActionMap[triggerSource];
            const provider = action.split(".")[0];
            if (connectedProviders.includes(provider)) {
                return action;
            }
        }
        // Fall back to first available read action
        if (compiled?.availableActions) {
            const readAction = compiled.availableActions.find((a) => {
                const actionStr = typeof a === "string" ? a : (a?.id || a?.toolName || a?.name || String(a || ""));
                const p = actionStr.includes(".") ? actionStr.split(".")[0] : actionStr;
                return connectedProviders.includes(p) && !actionStr.includes("send") && !actionStr.includes("create") && !actionStr.includes("deploy");
            });
            if (readAction) {
                return typeof readAction === "string" ? readAction : (readAction.id || readAction.toolName || String(readAction));
            }
        }
        return null;
    }
    riskLevelForAction(actionId) {
        if (actionId.includes("deploy") ||
            actionId.includes("send_message") ||
            actionId.includes("send_email") ||
            actionId.includes("refund") ||
            actionId.includes("merge")) {
            return "HIGH";
        }
        if (actionId.includes("create") ||
            actionId.includes("update") ||
            actionId.includes("write")) {
            return "MEDIUM";
        }
        return "LOW";
    }
    // ── Dashboard State ─────────────────────────────────────────────────────────
    async getDashboardState(companyId) {
        const [activeClones, runningExecutions, waitingApprovals, blockedCommitments, failedExecutions, overdueCommitments, openEscalations, recentEvents, recentExecutions, allClones,] = await Promise.all([
            database_1.prisma.aIEmployee.findMany({
                where: { companyId, status: "WORKING" },
            }).then((r) => r.length),
            database_1.prisma.runtimeExecution.count({
                where: { companyId, status: "EXECUTING" },
            }),
            database_1.prisma.approvalRequest.findMany({
                where: { companyId, status: "PENDING" },
            }).then((r) => r.length),
            database_1.prisma.runtimeCommitment.count({
                where: { companyId, status: "BLOCKED" },
            }),
            database_1.prisma.runtimeExecution.count({
                where: { companyId, status: "FAILED" },
            }),
            database_1.prisma.runtimeCommitment.count({
                where: { companyId, status: "OVERDUE" },
            }),
            database_1.prisma.runtimeEscalation.count({
                where: { companyId, status: "OPEN" },
            }),
            database_1.prisma.runtimeEvent.findMany({
                where: { companyId },
                take: 20,
            }),
            database_1.prisma.runtimeExecution.findMany({
                where: { companyId },
                take: 20,
                include: { clone: true },
            }),
            database_1.prisma.aIEmployee.findMany({ where: { companyId } }),
        ]);
        // Build per-Clone status
        const cloneStatuses = await Promise.all(allClones.map(async (clone) => {
            const activeExec = await database_1.prisma.runtimeExecution.findFirst({
                where: {
                    companyId,
                    cloneId: clone.id,
                    status: ["QUEUED", "PLANNING", "EXECUTING", "WAITING_FOR_APPROVAL", "WAITING_FOR_AUTHORITY"],
                },
            });
            return {
                cloneId: clone.id,
                name: clone.name,
                role: clone.role,
                avatarUrl: clone.avatarUrl,
                status: clone.status,
                currentTask: activeExec?.triggerSource,
                triggeredBy: activeExec?.triggerSource,
                delegatedTo: activeExec?.delegatedTo,
                lastActiveAt: activeExec?.startedAt
                    ? new Date(activeExec.startedAt)
                    : undefined,
                activeExecutionId: activeExec?.id,
            };
        }));
        return {
            companyId,
            activeClones,
            runningExecutions,
            waitingApprovals,
            blockedCommitments,
            failedExecutions,
            overdueCommitments,
            openEscalations,
            recentEvents: recentEvents.map((e) => ({
                id: e.id,
                source: e.source,
                eventType: e.eventType,
                createdAt: e.createdAt,
                processedAt: e.processedAt,
            })),
            recentExecutions: recentExecutions.map((e) => ({
                id: e.id,
                cloneId: e.cloneId,
                cloneName: e.clone?.name || "",
                cloneRole: e.clone?.role || "",
                status: e.status,
                triggerSource: e.triggerSource,
                startedAt: e.startedAt,
                completedAt: e.completedAt,
            })),
            cloneStatuses,
        };
    }
}
exports.RuntimeEngine = RuntimeEngine;
// Singleton instance — used by API routes and background worker
let _engine = null;
function getRuntimeEngine() {
    if (!_engine) {
        _engine = new RuntimeEngine();
    }
    return _engine;
}
//# sourceMappingURL=engine.js.map