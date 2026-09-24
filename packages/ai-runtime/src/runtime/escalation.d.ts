/**
 * Escalation Engine
 *
 * Handles escalation routing when a Clone:
 *   - Fails repeatedly (>= 2 failed attempts)
 *   - Has an overdue commitment
 *   - Waits for approval > 4 hours
 *   - Encounters a critical-severity event
 *
 * Escalation targets (resolved in priority order):
 *   1. Team lead Clone (if different from current Clone, severity LOW/MEDIUM)
 *   2. Human OWNER/ADMIN of the company (severity HIGH/CRITICAL)
 *   3. Company-wide fallback
 *
 * Severity:
 *   LOW      — team lead notified
 *   MEDIUM   — team lead + human owner notified
 *   HIGH     — immediate human notification
 *   CRITICAL — all channels, immediate action required
 */
export type EscalationInput = {
    companyId: string;
    cloneId: string;
    executionId?: string;
    commitmentId?: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    context?: Record<string, unknown>;
};
export type EscalationOutput = {
    escalationId: string;
    targetType: string;
    targetId: string;
    notified: boolean;
};
export declare class EscalationEngine {
    /**
     * Create and route an escalation record.
     */
    escalate(input: EscalationInput): Promise<EscalationOutput>;
    /**
     * Determine the best escalation target from team + membership structure.
     */
    private resolveTarget;
    /**
     * Mark an escalation as resolved.
     */
    resolve(escalationId: string, companyId: string, resolvedBy: string, notes?: string): Promise<void>;
    /**
     * Decide whether the current execution state warrants escalation.
     */
    shouldEscalate(input: {
        failedAttempts: number;
        overdue: boolean;
        waitingApprovalMs?: number;
        severity?: string;
    }): boolean;
    /**
     * Get all open escalations for a company.
     */
    getOpenEscalations(companyId: string): Promise<any[]>;
}
//# sourceMappingURL=escalation.d.ts.map