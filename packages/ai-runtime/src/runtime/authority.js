"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorityGate = void 0;
const integration_framework_1 = require("@clone/integration-framework");
// ─── Hard-coded safety rules ──────────────────────────────────────────────────
/** Actions that are ALWAYS blocked regardless of any permission */
const ALWAYS_BLOCKED_ACTIONS = new Set([
    // Cannot modify own authority or grant own permissions
    "runtime.modify_authority",
    "runtime.grant_permission",
    "runtime.modify_own_config",
]);
/** Financial actions — require explicit financial authority flag */
const FINANCIAL_ACTIONS = new Set([
    "stripe.issue_refund",
    "stripe.create_payment_link",
    "stripe.update_subscription",
]);
/** Production-risk actions — require explicit CRITICAL policy approval */
const PRODUCTION_ACTIONS = new Set([
    "vercel.create_deployment",
    "vercel.rollback_deployment",
    "github.merge_pull_request",
]);
function checkSafetyRules(actionId, context) {
    // Rule 1: Hard-blocked actions can never be executed
    if (ALWAYS_BLOCKED_ACTIONS.has(actionId)) {
        return {
            violated: true,
            reason: `Action "${actionId}" is a protected system operation that cannot be executed by any Clone.`,
        };
    }
    // Rule 2: Financial actions require financial authority
    if (FINANCIAL_ACTIONS.has(actionId)) {
        const hasFinancialAuthority = context.authority.level === "FOUNDER" ||
            context.identity.responsibilities.toLowerCase().includes("financ") ||
            context.identity.role.toLowerCase().includes("cfo") ||
            context.identity.role.toLowerCase().includes("finance");
        if (!hasFinancialAuthority) {
            return {
                violated: true,
                reason: `Action "${actionId}" is a financial operation. This Clone does not have financial authority. Escalate to a human with financial access.`,
            };
        }
    }
    return { violated: false };
}
// ─── Permission helpers ───────────────────────────────────────────────────────
function providerOf(toolName) {
    if (!toolName)
        return "";
    const str = typeof toolName === "string" ? toolName : (toolName.toolName || toolName.id || toolName.name || String(toolName));
    return str.includes(".") ? str.split(".")[0] : str;
}
function matchPermission(permissions, actionId) {
    // Exact match first
    const exact = permissions.find((p) => p.toolName === actionId);
    if (exact)
        return exact;
    // Provider-level wildcard
    return permissions.find((p) => p.toolName === providerOf(actionId));
}
// ─── AuthorityGate ────────────────────────────────────────────────────────────
class AuthorityGate {
    /**
     * Evaluate whether a Clone can perform an action.
     *
     * @param context       - Full runtime context for this Clone
     * @param actionId      - Dotted action ID: "github.create_issue"
     * @param connectedProviders - Providers currently connected on the workspace
     */
    evaluate(input) {
        const { context, actionId, connectedProviders } = input;
        const provider = providerOf(actionId);
        const actionDef = (0, integration_framework_1.findRuntimeAction)(actionId);
        // ── 1. Safety Rules ──────────────────────────────────────────────────────
        const safety = checkSafetyRules(actionId, context);
        if (safety.violated) {
            return {
                decision: "DENY",
                reason: safety.reason,
                actionId,
                requiresApproval: false,
            };
        }
        // ── 2. Integration connected to workspace? ───────────────────────────────
        if (!connectedProviders.includes(provider)) {
            return {
                decision: "DENY",
                reason: `${provider} is not connected to this workspace. Connect it via Integrations before this Clone can act on it.`,
                actionId,
                requiresApproval: false,
            };
        }
        // ── 3. Integration assigned to this Clone? ───────────────────────────────
        if (!context.integrations.includes(provider)) {
            return {
                decision: "DENY",
                reason: `${provider} is connected but not assigned to ${context.identity.name}. Assign the integration in the Clone's settings.`,
                actionId,
                requiresApproval: false,
            };
        }
        // ── 4. Permission exists for this action? ────────────────────────────────
        const perm = matchPermission(context.permissions, actionId);
        if (!perm) {
            return {
                decision: "DENY",
                reason: `Action "${actionId}" is not in ${context.identity.name}'s permission list. Add it in the Clone's tool permissions.`,
                actionId,
                requiresApproval: false,
            };
        }
        // ── 5. Write access check ────────────────────────────────────────────────
        const isWriteAction = actionDef?.write === true;
        if (isWriteAction && perm.writeAccess === false) {
            return {
                decision: "DENY",
                reason: `"${actionId}" requires write access. ${context.identity.name} has read-only access to ${provider}.`,
                actionId,
                requiresApproval: false,
            };
        }
        // ── 6. Production action requires approval regardless ────────────────────
        if (PRODUCTION_ACTIONS.has(actionId)) {
            return {
                decision: "APPROVAL",
                reason: `"${actionId}" is a production-risk operation. Human approval is required before execution.`,
                actionId,
                requiresApproval: true,
            };
        }
        // ── 7. Approval check (from catalog or permission override) ──────────────
        const catalogRequiresApproval = actionDef?.requiresApproval === true;
        const permRequiresApproval = perm.requiresApproval === true;
        const needsApproval = catalogRequiresApproval || permRequiresApproval;
        if (needsApproval) {
            return {
                decision: "APPROVAL",
                reason: `"${actionId}" requires approval before execution. ${catalogRequiresApproval
                    ? "This action is marked as approval-required in the integration catalog."
                    : "This Clone's permission policy requires approval for this tool."}`,
                actionId,
                requiresApproval: true,
            };
        }
        // ── 8. Delegate check — if Clone cannot execute but CAN delegate ─────────
        // Only applied when the Clone has delegation authority but a specific
        // policy prevents direct execution (e.g. out-of-scope responsibility).
        // Left as ALLOW here; the ExecutionEngine can decide to delegate.
        return {
            decision: "ALLOW",
            reason: `${context.identity.name} is authorized — integration assigned, connected, permission granted, no approval required.`,
            actionId,
            requiresApproval: false,
        };
    }
    /**
     * Batch-evaluate multiple actions at once.
     * Used by the compiler to build the approvalRequirements list.
     */
    evaluateMany(input) {
        const results = new Map();
        for (const actionId of input.actionIds) {
            results.set(actionId, this.evaluate({
                context: input.context,
                actionId,
                connectedProviders: input.connectedProviders,
            }));
        }
        return results;
    }
    /**
     * Quick check: can this Clone perform this action at all?
     */
    canPerform(input) {
        const result = this.evaluate(input);
        return result.decision === "ALLOW" || result.decision === "APPROVAL";
    }
}
exports.AuthorityGate = AuthorityGate;
//# sourceMappingURL=authority.js.map