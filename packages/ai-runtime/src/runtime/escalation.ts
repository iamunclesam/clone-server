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

import { prisma } from "@clone/database";

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

export class EscalationEngine {
  /**
   * Create and route an escalation record.
   */
  async escalate(input: EscalationInput): Promise<EscalationOutput> {
    const { companyId, cloneId, reason, severity } = input;

    const { targetType, targetId } = await this.resolveTarget(
      cloneId,
      companyId,
      severity
    );

    const escalation = await prisma.runtimeEscalation.create({
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

    const clone = await prisma.aIEmployee.findFirst({
      where: { id: cloneId, companyId },
    });

    await prisma.activityLog.create({
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
  private async resolveTarget(
    cloneId: string,
    companyId: string,
    severity: string
  ): Promise<{ targetType: string; targetId: string }> {
    const clone = await prisma.aIEmployee.findFirst({
      where: { id: cloneId, companyId },
    });

    // For LOW/MEDIUM: team lead Clone is sufficient
    if (clone?.teamId && (severity === "LOW" || severity === "MEDIUM")) {
      const team = await prisma.team.findUnique({
        where: { id: clone.teamId },
      });
      if (team?.leadEmployeeId && team.leadEmployeeId !== cloneId) {
        return { targetType: "CLONE", targetId: team.leadEmployeeId };
      }
    }

    // For HIGH/CRITICAL or no team lead: escalate to human owner/admin
    const memberships = await prisma.membership.findMany({
      where: { companyId },
    });

    const owner = memberships.find((m: any) => m.role === "OWNER");
    if (owner) {
      return { targetType: "HUMAN", targetId: owner.userId };
    }

    const admin = memberships.find((m: any) => m.role === "ADMIN");
    if (admin) {
      return { targetType: "HUMAN", targetId: admin.userId };
    }

    // Final fallback
    return { targetType: "TEAM_LEAD", targetId: companyId };
  }

  /**
   * Mark an escalation as resolved.
   */
  async resolve(
    escalationId: string,
    companyId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await prisma.runtimeEscalation.update({
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
  shouldEscalate(input: {
    failedAttempts: number;
    overdue: boolean;
    waitingApprovalMs?: number;
    severity?: string;
  }): boolean {
    if (input.severity === "CRITICAL") return true;
    if (input.overdue) return true;
    if (input.failedAttempts >= 2) return true;
    if ((input.waitingApprovalMs || 0) > 4 * 60 * 60 * 1000) return true;
    return false;
  }

  /**
   * Get all open escalations for a company.
   */
  async getOpenEscalations(companyId: string): Promise<any[]> {
    return prisma.runtimeEscalation.findMany({
      where: { companyId, status: "OPEN" },
      take: 50,
    });
  }
}
