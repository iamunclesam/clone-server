"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitmentMonitor = void 0;
const database_1 = require("@clone/database");
// How far in advance to send a reminder (ms)
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // 1 hour before deadline
// How long past deadline before escalating (ms)
const ESCALATION_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours overdue
class CommitmentMonitor {
    /**
     * Scan all open/in-progress commitments for a company and take action.
     * Called by the scheduler on every "commitment_check" job.
     */
    async scan(companyId) {
        const now = new Date();
        const result = {
            checked: 0,
            markedOverdue: 0,
            reminded: 0,
            escalated: 0,
        };
        const commitments = await database_1.prisma.runtimeCommitment.findMany({
            where: {
                companyId,
                status: ["OPEN", "IN_PROGRESS", "BLOCKED"],
            },
            take: 200,
        });
        result.checked = commitments.length;
        for (const commitment of commitments) {
            if (!commitment.dueAt)
                continue;
            const dueAt = new Date(commitment.dueAt);
            const msUntilDue = dueAt.getTime() - now.getTime();
            const msOverdue = now.getTime() - dueAt.getTime();
            // ── 1. Mark overdue ────────────────────────────────────────────────────
            if (msUntilDue <= 0 && commitment.status !== "OVERDUE") {
                await database_1.prisma.runtimeCommitment.update({
                    where: { id: commitment.id },
                    data: { status: "OVERDUE" },
                });
                result.markedOverdue++;
                // Activity log
                const clone = await database_1.prisma.aIEmployee.findFirst({
                    where: { id: commitment.cloneId },
                });
                await database_1.prisma.activityLog.create({
                    data: {
                        companyId,
                        employeeId: commitment.cloneId,
                        actorName: "Commitment Monitor",
                        action: "COMMITMENT_OVERDUE",
                        resource: commitment.title,
                        details: `Commitment "${commitment.title}" is overdue. Due: ${dueAt.toISOString()}`,
                    },
                });
            }
            // ── 2. Send reminder when approaching deadline ─────────────────────────
            else if (msUntilDue > 0 &&
                msUntilDue <= REMINDER_WINDOW_MS &&
                !commitment.reminderSentAt) {
                await database_1.prisma.runtimeCommitment.update({
                    where: { id: commitment.id },
                    data: { reminderSentAt: now },
                });
                result.reminded++;
                await database_1.prisma.activityLog.create({
                    data: {
                        companyId,
                        employeeId: commitment.cloneId,
                        actorName: "Commitment Monitor",
                        action: "COMMITMENT_REMINDER",
                        resource: commitment.title,
                        details: `Reminder: "${commitment.title}" is due in ${Math.round(msUntilDue / 60000)} minutes.`,
                    },
                });
            }
            // ── 3. Escalate critically overdue commitments ─────────────────────────
            if (commitment.status === "OVERDUE" &&
                msOverdue >= ESCALATION_THRESHOLD_MS &&
                !commitment.escalatedAt) {
                await this.escalateCommitment(commitment, companyId, now);
                result.escalated++;
            }
        }
        return result;
    }
    /**
     * Create an escalation record for an overdue commitment.
     */
    async escalateCommitment(commitment, companyId, now) {
        // Determine severity based on priority
        const severityMap = {
            URGENT: "CRITICAL",
            HIGH: "HIGH",
            MEDIUM: "MEDIUM",
            LOW: "LOW",
        };
        const severity = severityMap[commitment.priority] || "MEDIUM";
        // Find the team lead to escalate to
        const clone = await database_1.prisma.aIEmployee.findFirst({
            where: { id: commitment.cloneId, companyId },
        });
        let targetType = "TEAM_LEAD";
        let targetId = companyId; // fallback to company-wide notification
        if (clone?.teamId) {
            const team = await database_1.prisma.team.findUnique({
                where: { id: clone.teamId },
            });
            if (team?.leadEmployeeId && team.leadEmployeeId !== commitment.cloneId) {
                targetType = "CLONE";
                targetId = team.leadEmployeeId;
            }
        }
        await database_1.prisma.runtimeEscalation.create({
            data: {
                companyId,
                cloneId: commitment.cloneId,
                commitmentId: commitment.id,
                reason: `Commitment "${commitment.title}" is critically overdue. No completion reported.`,
                severity,
                targetType,
                targetId,
                status: "OPEN",
            },
        });
        // Mark commitment as escalated
        await database_1.prisma.runtimeCommitment.update({
            where: { id: commitment.id },
            data: { escalatedAt: now },
        });
        await database_1.prisma.activityLog.create({
            data: {
                companyId,
                employeeId: commitment.cloneId,
                actorName: "Commitment Monitor",
                action: "COMMITMENT_ESCALATED",
                resource: commitment.title,
                details: `Escalated overdue commitment "${commitment.title}" to ${targetType} (${targetId}).`,
            },
        });
    }
    /**
     * Mark a commitment as completed.
     * Called by ExecutionEngine after successful execution.
     */
    async complete(commitmentId, companyId) {
        const commitment = await database_1.prisma.runtimeCommitment.findFirst({
            where: { id: commitmentId, companyId },
        });
        if (!commitment)
            return;
        await database_1.prisma.runtimeCommitment.update({
            where: { id: commitmentId },
            data: { status: "COMPLETED", completedAt: new Date() },
        });
        await database_1.prisma.activityLog.create({
            data: {
                companyId,
                employeeId: commitment.cloneId,
                actorName: "Runtime Engine",
                action: "COMMITMENT_COMPLETED",
                resource: commitment.title,
                details: `Commitment "${commitment.title}" marked as completed.`,
            },
        });
    }
    /**
     * Mark a commitment as blocked (waiting on external dependency).
     */
    async markBlocked(commitmentId, companyId, reason) {
        await database_1.prisma.runtimeCommitment.update({
            where: { id: commitmentId },
            data: { status: "BLOCKED", description: reason },
        });
    }
    /**
     * Create a new commitment from an execution.
     */
    async createFromExecution(input) {
        return database_1.prisma.runtimeCommitment.create({
            data: {
                companyId: input.companyId,
                cloneId: input.cloneId,
                title: input.title,
                description: input.description,
                source: "execution",
                sourceId: input.sourceExecutionId,
                ownerCloneId: input.cloneId,
                dueAt: input.dueAt,
                status: "IN_PROGRESS",
                priority: input.priority || "MEDIUM",
            },
        });
    }
    /**
     * Get open commitments for a Clone.
     */
    async getOpenCommitments(cloneId, companyId) {
        return database_1.prisma.runtimeCommitment.findMany({
            where: {
                cloneId,
                companyId,
                status: ["OPEN", "IN_PROGRESS", "BLOCKED", "OVERDUE"],
            },
            take: 50,
        });
    }
}
exports.CommitmentMonitor = CommitmentMonitor;
//# sourceMappingURL=commitments.js.map