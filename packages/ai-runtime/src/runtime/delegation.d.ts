/**
 * Delegation Engine
 *
 * Handles structured task delegation between Clones (and to humans).
 *
 * Delegation is NOT just sending a message. It creates:
 *   1. A validated DelegationTask with title, objective, context, deadline, priority
 *   2. A Task record in DB assigned to the target Clone
 *   3. A RuntimeCommitment tracking the delegated work
 *   4. An ActivityLog entry
 *
 * Before delegation, the engine validates:
 *   - Target Clone exists in the same company
 *   - Target Clone has relevant integrations
 *   - Target Clone has relevant permissions for the required work
 *   - Target Clone is not PAUSED
 *   - Target Clone is not already at capacity (optional future: load check)
 */
import { type CompiledRuntime } from "./types";
export type DelegationInput = {
    fromCloneId: string;
    toCloneId: string;
    companyId: string;
    title: string;
    objective: string;
    context: string;
    deadline?: Date;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    expectedOutput: string;
    sourceExecutionId?: string;
    requiredIntegrations?: string[];
    requiredActions?: string[];
};
export type DelegationResult = {
    success: boolean;
    taskId?: string;
    commitmentId?: string;
    error?: string;
};
export type DelegationValidation = {
    valid: boolean;
    reason: string;
    targetClone?: {
        id: string;
        name: string;
        role: string;
    };
};
export declare class DelegationEngine {
    /**
     * Validate that delegation is possible before executing it.
     */
    validate(input: {
        fromCloneId: string;
        toCloneId: string;
        companyId: string;
        requiredIntegrations?: string[];
        requiredActions?: string[];
    }): Promise<DelegationValidation>;
    /**
     * Execute a delegation: validate, create Task + Commitment, log activity.
     */
    delegate(input: DelegationInput): Promise<DelegationResult>;
    /**
     * Choose the best delegation target from a compiled runtime.
     * Returns the first available target that is not PAUSED.
     */
    chooseBestTarget(compiled: CompiledRuntime, companyId: string): Promise<{
        employeeId: string;
        name: string;
        role: string;
        reason: string;
    } | null>;
}
//# sourceMappingURL=delegation.d.ts.map