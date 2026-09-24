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
import { type CloneRuntimeContext, type CompiledRuntime, type RuntimeScheduleSpec, type CloneIdentity } from "./types";
/**
 * Build a single lowercase string combining role + name + responsibilities.
 * This is what relevance keywords are matched against.
 */
declare function buildIdentityText(identity: CloneIdentity): string;
/**
 * Generate default schedules for a Clone based on its role + live integrations.
 * Schedules are DEFAULTS — they are only created when the relevant integration
 * is live AND the Clone's role matches.
 */
declare function generateSchedules(identityText: string, liveProviders: string[]): RuntimeScheduleSpec[];
export declare class RuntimeCompiler {
    /**
     * Compile a Clone's full runtime context into a CompiledRuntime.
     * This is the pure in-memory version — used by tests and the engine's
     * internal fast-path. Does NOT write to DB.
     */
    compile(companyId: string, ctx: CloneRuntimeContext, connectedProviders: string[]): CompiledRuntime;
    /**
     * isEventRelevant — fast check using a pre-compiled runtime.
     */
    isEventRelevant(compiled: CompiledRuntime, eventId: string): boolean;
    /**
     * canPerformAction — check if an action is in the compiled runtime.
     */
    canPerformAction(compiled: CompiledRuntime, actionId: string): boolean;
    /**
     * requiresApproval — check if an action requires human approval.
     */
    requiresApproval(compiled: CompiledRuntime, actionId: string): boolean;
}
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
export declare function compileRuntime(cloneId: string, companyId: string): Promise<CompiledRuntime>;
export { RUNTIME_INTEGRATIONS } from "@clone/integration-framework";
export { buildIdentityText, generateSchedules };
//# sourceMappingURL=compiler.d.ts.map