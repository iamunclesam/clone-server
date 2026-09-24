/**
 * Commitment Monitor
 *
 * Tracks promises/obligations that Clones have made and monitors their status.
 *
 * A Commitment is created when:
 *   - A Clone accepts a delegated task
 *   - A Clone starts an execution that has a deadline
 *   - A Clone explicitly commits to delivering something
 *   - A human assigns work to a Clone
 *
 * The monitor runs on the "commitment_check" schedule (every 15 minutes) and:
 *   1. Marks overdue commitments (dueAt <= now AND not completed)
 *   2. Sends reminders when approaching deadline (< 1 hour remaining)
 *   3. Triggers escalation for critically overdue items
 *   4. Updates commitment status transitions
 *
 * Status lifecycle:
 *   OPEN → IN_PROGRESS → COMPLETED
 *   OPEN → IN_PROGRESS → BLOCKED → (escalate)
 *   OPEN → OVERDUE → (escalate)
 *   OPEN → CANCELLED
 */
export type CommitmentScanResult = {
    checked: number;
    markedOverdue: number;
    reminded: number;
    escalated: number;
};
export declare class CommitmentMonitor {
    /**
     * Scan all open/in-progress commitments for a company and take action.
     * Called by the scheduler on every "commitment_check" job.
     */
    scan(companyId: string): Promise<CommitmentScanResult>;
    /**
     * Create an escalation record for an overdue commitment.
     */
    private escalateCommitment;
    /**
     * Mark a commitment as completed.
     * Called by ExecutionEngine after successful execution.
     */
    complete(commitmentId: string, companyId: string): Promise<void>;
    /**
     * Mark a commitment as blocked (waiting on external dependency).
     */
    markBlocked(commitmentId: string, companyId: string, reason: string): Promise<void>;
    /**
     * Create a new commitment from an execution.
     */
    createFromExecution(input: {
        companyId: string;
        cloneId: string;
        title: string;
        description?: string;
        sourceExecutionId: string;
        dueAt?: Date;
        priority?: string;
    }): Promise<any>;
    /**
     * Get open commitments for a Clone.
     */
    getOpenCommitments(cloneId: string, companyId: string): Promise<any[]>;
}
//# sourceMappingURL=commitments.d.ts.map