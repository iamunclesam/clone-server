/**
 * Authority Gate
 *
 * The single enforcement point for all Clone actions.
 * No tool can be executed without passing through this gate.
 *
 * Evaluation order:
 *   1. Safety Rules (hard blocks — cannot be bypassed)
 *   2. Integration connected? (is the provider live on the workspace?)
 *   3. Integration assigned? (does this Clone have this provider?)
 *   4. Permission exists? (is this action in Clone's permission list?)
 *   5. Write access check (read-only Clone cannot perform write actions)
 *   6. Approval check (does policy or permission require human approval?)
 *   7. ALLOW
 *
 * Safety Rules (always enforced):
 *   - LLM cannot modify its own authority
 *   - Clone cannot grant itself permissions
 *   - Financial actions require explicit financial authority
 *   - Production deployments require CRITICAL risk policy
 *   - Every action must have a companyId
 *   - Clone cannot access another Clone's private memory without permission
 */
import { type AuthorityResult, type CloneRuntimeContext } from "./types";
export type { AuthorityResult };
export declare class AuthorityGate {
    /**
     * Evaluate whether a Clone can perform an action.
     *
     * @param context       - Full runtime context for this Clone
     * @param actionId      - Dotted action ID: "github.create_issue"
     * @param connectedProviders - Providers currently connected on the workspace
     */
    evaluate(input: {
        context: CloneRuntimeContext;
        actionId: string;
        connectedProviders: string[];
    }): AuthorityResult;
    /**
     * Batch-evaluate multiple actions at once.
     * Used by the compiler to build the approvalRequirements list.
     */
    evaluateMany(input: {
        context: CloneRuntimeContext;
        actionIds: string[];
        connectedProviders: string[];
    }): Map<string, AuthorityResult>;
    /**
     * Quick check: can this Clone perform this action at all?
     */
    canPerform(input: {
        context: CloneRuntimeContext;
        actionId: string;
        connectedProviders: string[];
    }): boolean;
}
//# sourceMappingURL=authority.d.ts.map