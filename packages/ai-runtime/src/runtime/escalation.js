"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationEngine = void 0;
const database_1 = require("@clone/database");
class EscalationEngine {
    /**
     * Create and route an escalation record.
     */
    async escalate(input) {
        const { companyId, cloneId, reason, severity } = input;
        const { targetType, targetId } = await this.resolveTarget(cloneId, companyId, severity);
        const escalation = await database_1.prisma.runtimeEscalation.create({
            data: {
                companyId,
                cloneId,
                executionId: input.executionId || null,
                commitmentId: input.commitmentId || null,
                reason,
                severity,
                targetType,
                targetId,
                status: "OPEN",
            },
        });
        const clone = await database_1.prisma.aIEmployee.findFirst({
            where: { id: cloneId, companyId },
        });
        await database_1.prisma.activityLog.create({
            data: {
                companyId,
                employeeId: cloneId,
                actorName: clone?.name || "Runtime Engine",
                action: "ESCALATION_CREATED",
                resource: reason.substring(0, 100),
                details: `[${severity}] Escalated to ${targetType} (${targetId}). Reason: ${reason}`,
            },
        });
        return {
            escalationId: escalation.id,
            targetType,
            targetId,
            notified: true,
        };
    }
    /**
     * Determine the best escalation target from team + membership structure.
     */
    async resolveTarget(cloneId, companyId, severity) {
        const clone = await database_1.prisma.aIEmployee.findFirst({
            where: { id: cloneId, companyId },
        });
        // For LOW/MEDIUM: team lead Clone is sufficient
        if (clone?.teamId && (severity === "LOW" || severity === "MEDIUM")) {
            const team = await database_1.prisma.team.findUnique({
                where: { id: clone.teamId },
            });
            if (team?.leadEmployeeId && team.leadEmployeeId !== cloneId) {
                return { targetType: "CLONE", targetId: team.leadEmployeeId };
            }
        }
        // For HIGH/CRITICAL or no team lead: escalate to human owner/admin
        const memberships = await database_1.prisma.membership.findMany({
            where: { companyId },
        });
        const owner = memberships.find((m) => m.role === "OWNER");
        if (owner) {
            return { targetType: "HUMAN", targetId: owner.userId };
        }
        const admin = memberships.find((m) => m.role === "ADMIN");
        if (admin) {
            return { targetType: "HUMAN", targetId: admin.userId };
        }
        // Final fallback
        return { targetType: "TEAM_LEAD", targetId: companyId };
    }
    /**
     * Mark an escalation as resolved.
     */
    async resolve(escalationId, companyId, resolvedBy, notes) {
        await database_1.prisma.runtimeEscalation.update({
            where: { id: escalationId },
            data: {
                status: "RESOLVED",
                resolvedAt: new Date(),
                resolvedBy,
                notes: notes || null,
            },
        });
    }
    /**
     * Decide whether the current execution state warrants escalation.
     */
    shouldEscalate(input) {
        if (input.severity === "CRITICAL")
            return true;
        if (input.overdue)
            return true;
        if (input.failedAttempts >= 2)
            return true;
        if ((input.waitingApprovalMs || 0) > 4 * 60 * 60 * 1000)
            return true;
        return false;
    }
    /**
     * Get all open escalations for a company.
     */
    async getOpenEscalations(companyId) {
        return database_1.prisma.runtimeEscalation.findMany({
            where: { companyId, status: "OPEN" },
            take: 50,
        });
    }
}
exports.EscalationEngine = EscalationEngine;
//# sourceMappingURL=escalation.js.map