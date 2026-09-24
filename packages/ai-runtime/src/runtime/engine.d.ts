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
import { type InboundEvent, type RouteResult } from "./event-router";
import type { CompiledRuntime, CloneWakeInput, ExecutionResult, RuntimeDashboardState } from "./types";
export declare class RuntimeEngine {
    private scheduler;
    private router;
    private authority;
    private delegation;
    private commitments;
    private escalation;
    private memory;
    private registry;
    private started;
    constructor();
    start(): void;
    /**
     * Compile runtimes for every active clone across all companies.
     * This is what makes clones "always awake" — their schedules and triggers
     * are registered in DB so the scheduler can fire them.
     */
    private bootstrapAllClones;
    stop(): void;
    compileCloneRuntime(cloneId: string, companyId: string): Promise<CompiledRuntime>;
    ingestEvent(event: InboundEvent): Promise<RouteResult>;
    private handleScheduledJob;
    wakeClone(input: CloneWakeInput): Promise<ExecutionResult>;
    executeById(executionId: string, companyId: string): Promise<ExecutionResult>;
    private runExecution;
    private postToTeamChannel;
    private performSmartDelegation;
    private finaliseExecution;
    /**
     * Derive a proposed action from the trigger source and compiled runtime.
     * Priority: trigger event → compiled available actions → null (observe-only).
     */
    private resolveActionFromTrigger;
    private riskLevelForAction;
    getDashboardState(companyId: string): Promise<RuntimeDashboardState>;
}
export declare function getRuntimeEngine(): RuntimeEngine;
//# sourceMappingURL=engine.d.ts.map