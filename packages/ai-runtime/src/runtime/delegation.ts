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

import { prisma } from "@clone/database";
import { type CompiledRuntime, type DelegationTask } from "./types";

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

export class DelegationEngine {
  /**
   * Validate that delegation is possible before executing it.
   */
  async validate(input: {
    fromCloneId: string;
    toCloneId: string;
    companyId: string;
    requiredIntegrations?: string[];
    requiredActions?: string[];
  }): Promise<DelegationValidation> {
    const { fromCloneId, toCloneId, companyId } = input;

    // ── 1. Source Clone must be a lead / have delegation authority ───────────
    const fromClone = await prisma.aIEmployee.findFirst({
      where: { id: fromCloneId, companyId },
    });
    if (!fromClone) {
      return { valid: false, reason: `Source Clone ${fromCloneId} not found.` };
    }

    // ── 2. Target Clone must exist in same company ───────────────────────────
    const toClone = await prisma.aIEmployee.findFirst({
      where: { id: toCloneId, companyId },
    });
    if (!toClone) {
      return {
        valid: false,
        reason: `Target Clone ${toCloneId} not found in this company.`,
      };
    }

    // ── 3. Target Clone must not be PAUSED ───────────────────────────────────
    if (toClone.status === "PAUSED") {
      return {
        valid: false,
        reason: `Target Clone "${toClone.name}" is currently PAUSED and cannot accept delegated work.`,
      };
    }

    // ── 4. Cannot delegate to self ───────────────────────────────────────────
    if (fromCloneId === toCloneId) {
      return { valid: false, reason: "A Clone cannot delegate to itself." };
    }

    // ── 5. Required integrations check ──────────────────────────────────────
    if (input.requiredIntegrations && input.requiredIntegrations.length > 0) {
      const connectedAccounts = await prisma.connectedAccount.findMany({
        where: { companyId, status: "CONNECTED" },
      });
      const connectedProviders = new Set(
        connectedAccounts.map((a: any) => a.provider)
      );

      for (const provider of input.requiredIntegrations) {
        if (!connectedProviders.has(provider)) {
          return {
            valid: false,
            reason: `Required integration "${provider}" is not connected to this workspace. Target Clone cannot complete this work without it.`,
          };
        }
      }

      // Check target Clone has the integration in its permissions
      const targetPermProviders = new Set(
        (toClone.permissions || []).map((p: any) => {
          const name = typeof p === "string" ? p : (p?.toolName || p?.id || p?.name || String(p || ""));
          return name.includes(".") ? name.split(".")[0] : name;
        })
      );
      for (const provider of input.requiredIntegrations) {
        if (!targetPermProviders.has(provider)) {
          return {
            valid: false,
            reason: `Target Clone "${toClone.name}" does not have "${provider}" assigned in its permissions. Cannot delegate work that requires this integration.`,
          };
        }
      }
    }

    return {
      valid: true,
      reason: `"${toClone.name}" is available and qualified to receive this delegation.`,
      targetClone: { id: toClone.id, name: toClone.name, role: toClone.role },
    };
  }

  /**
   * Execute a delegation: validate, create Task + Commitment, log activity.
   */
  async delegate(input: DelegationInput): Promise<DelegationResult> {
    // Validate first
    const validation = await this.validate({
      fromCloneId: input.fromCloneId,
      toCloneId: input.toCloneId,
      companyId: input.companyId,
      requiredIntegrations: input.requiredIntegrations,
      requiredActions: input.requiredActions,
    });

    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const fromClone = await prisma.aIEmployee.findFirst({
      where: { id: input.fromCloneId, companyId: input.companyId },
    });

    try {
      // ── Create Task ────────────────────────────────────────────────────────
      const task = await prisma.task.create({
        data: {
          companyId: input.companyId,
          assignedEmployeeId: input.toCloneId,
          title: input.title,
          description: `${input.objective}\n\nContext:\n${input.context}\n\nExpected output:\n${input.expectedOutput}`,
          naturalPrompt: input.objective,
          status: "PENDING",
          priority: input.priority || "MEDIUM",
          approvalRequired: false,
        },
      });

      // ── Create Commitment ──────────────────────────────────────────────────
      const commitment = await prisma.runtimeCommitment.create({
        data: {
          companyId: input.companyId,
          cloneId: input.toCloneId,
          title: input.title,
          description: `${input.objective}\n\nExpected output: ${input.expectedOutput}`,
          source: "delegation",
          sourceId: input.sourceExecutionId || task.id,
          ownerCloneId: input.toCloneId,
          dueAt: input.deadline,
          status: "OPEN",
          priority: input.priority || "MEDIUM",
        },
      });

      // ── Log activity ───────────────────────────────────────────────────────
      await prisma.activityLog.create({
        data: {
          companyId: input.companyId,
          employeeId: input.fromCloneId,
          actorName: fromClone?.name || "Runtime Engine",
          action: "TASK_DELEGATED",
          resource: input.title,
          details: `Delegated to ${validation.targetClone?.name} (${validation.targetClone?.role}). Deadline: ${input.deadline?.toISOString() || "unset"}. Priority: ${input.priority || "MEDIUM"}.`,
        },
      });

      // ── Update source execution with delegation info ───────────────────────
      if (input.sourceExecutionId) {
        const exec = await prisma.runtimeExecution.findFirst({
          where: { id: input.sourceExecutionId },
        });
        if (exec) {
          const stepLog: any[] = exec.stepLog || [];
          stepLog.push({
            step: stepLog.length + 1,
            state: "EXECUTING",
            timestamp: new Date(),
            details: `Delegated "${input.title}" to ${validation.targetClone?.name}.`,
            toolCall: {
              toolName: "delegation.create_task",
              args: { toCloneId: input.toCloneId, title: input.title },
              result: { taskId: task.id, commitmentId: commitment.id },
            },
          });
          await prisma.runtimeExecution.update({
            where: { id: input.sourceExecutionId },
            data: {
              delegatedTo: input.toCloneId,
              stepLog,
            },
          });
        }
      }

      return {
        success: true,
        taskId: task.id,
        commitmentId: commitment.id,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "Delegation failed" };
    }
  }

  /**
   * Choose the best delegation target from a compiled runtime.
   * Returns the first available target that is not PAUSED.
   */
  async chooseBestTarget(
    compiled: CompiledRuntime,
    companyId: string
  ): Promise<{ employeeId: string; name: string; role: string; reason: string } | null> {
    for (const target of compiled.delegationTargets) {
      const clone = await prisma.aIEmployee.findFirst({
        where: { id: target.employeeId, companyId },
      });
      if (clone && clone.status !== "PAUSED") {
        return {
          employeeId: clone.id,
          name: clone.name,
          role: clone.role,
          reason: target.reason,
        };
      }
    }
    return null;
  }
}
