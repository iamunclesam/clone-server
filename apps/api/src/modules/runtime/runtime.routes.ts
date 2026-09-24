/**
 * Runtime Engine API Routes
 *
 * All routes are scoped under /api/v1/companies/:companyId/runtime
 *
 * Endpoints:
 *
 *  POST   /events                      Ingest an inbound event (webhook or manual)
 *  GET    /events                      List recent runtime events
 *  GET    /dashboard                   Full runtime dashboard state
 *
 *  POST   /clones/:cloneId/compile     Compile (or re-compile) a Clone's runtime
 *  GET    /clones/:cloneId/runtime     Get a Clone's compiled runtime state
 *  POST   /clones/:cloneId/wake        Manually wake a Clone
 *  GET    /clones/:cloneId/executions  List executions for a Clone
 *  GET    /clones/:cloneId/schedules   List schedules for a Clone
 *  GET    /clones/:cloneId/commitments List commitments for a Clone
 *  GET    /clones/:cloneId/status      Current runtime status for a Clone
 *
 *  GET    /executions                  List all recent executions
 *  GET    /executions/:executionId     Get execution detail + step log
 *
 *  GET    /schedules                   List all schedules for this company
 *  POST   /schedules/:scheduleId/trigger  Manually trigger a schedule
 *
 *  GET    /commitments                 List all commitments
 *  PATCH  /commitments/:commitmentId   Update a commitment status
 *
 *  GET    /escalations                 List open escalations
 *  POST   /escalations/:escalationId/resolve  Resolve an escalation
 *
 *  POST   /compile-all                 Re-compile all Clones in the company
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { getRuntimeEngine } from "@clone/ai-runtime";

// ── Validation schemas ─────────────────────────────────────────────────────────

const ingestEventSchema = z.object({
  source: z.string().min(1).max(50),
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  deduplicationKey: z.string().max(200).optional(),
});

const wakeCloneSchema = z.object({
  reason: z.string().min(1).max(500),
  trigger: z.object({
    kind: z.enum(["EVENT", "CRON", "INTERVAL", "DEADLINE", "CONDITION", "MANUAL"]),
    eventId: z.string().optional(),
    provider: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    source: z.string().optional(),
    taskType: z.string().optional(),
  }),
  context: z.record(z.unknown()).optional(),
});

const updateCommitmentSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "OVERDUE", "CANCELLED"]).optional(),
  description: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

const resolveEscalationSchema = z.object({
  notes: z.string().optional(),
});

// ── Guard helper ───────────────────────────────────────────────────────────────

async function guardCompany(
  companyId: string,
  userId: string,
  reply: any,
  requestId: string
): Promise<boolean> {
  const m = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!m) {
    reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Access denied", requestId },
    });
    return false;
  }
  return true;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function runtimeRoutes(app: FastifyInstance) {
  const engine = getRuntimeEngine();

  // ────────────────────────────────────────────────────────────────────────────
  // EVENTS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * POST /events
   * Ingest an inbound integration event. Automatically routes to relevant Clones.
   */
  app.post("/:companyId/runtime/events", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const body = ingestEventSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid event fields", requestId: req.id },
      });
    }

    const result = await engine.ingestEvent({
      companyId,
      source: body.data.source,
      eventType: body.data.eventType,
      payload: body.data.payload,
      deduplicationKey: body.data.deduplicationKey,
    });

    return reply.status(201).send({ success: true, data: result, requestId: req.id });
  });

  /**
   * GET /events
   * List recent runtime events for the company.
   */
  app.get("/:companyId/runtime/events", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { source, limit } = req.query as Record<string, string>;
    const events = await prisma.runtimeEvent.findMany({
      where: {
        companyId,
        ...(source ? { source } : {}),
      },
      take: Math.min(Number(limit) || 50, 200),
    });

    return reply.send({ success: true, data: { events }, requestId: req.id });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // DASHBOARD
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /dashboard
   * Full runtime dashboard state — active clones, executions, approvals, etc.
   */
  app.get("/:companyId/runtime/dashboard", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const state = await engine.getDashboardState(companyId);
    return reply.send({ success: true, data: state, requestId: req.id });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CLONE RUNTIME
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * POST /clones/:cloneId/compile
   * Compile (or re-compile) a Clone's runtime — derives triggers, schedules, actions.
   */
  app.post("/:companyId/runtime/clones/:cloneId/compile", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    try {
      const compiled = await engine.compileCloneRuntime(cloneId, companyId);
      await prisma.activityLog.create({
        data: {
          companyId,
          employeeId: cloneId,
          actorName: req.user!.email,
          action: "RUNTIME_COMPILED",
          resource: cloneId,
          details: `Runtime compiled: ${compiled.relevantEvents.length} events, ${compiled.availableActions.length} actions, ${compiled.schedules.length} schedules.`,
        },
      });
      return reply.status(201).send({ success: true, data: { compiled }, requestId: req.id });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: "COMPILE_ERROR", message: err?.message || "Compilation failed", requestId: req.id },
      });
    }
  });

  /**
   * GET /clones/:cloneId/runtime
   * Get a Clone's compiled runtime state (cached).
   */
  app.get("/:companyId/runtime/clones/:cloneId/runtime", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const state = await prisma.compiledRuntimeState.findFirst({
      where: { cloneId, companyId },
    });

    if (!state) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "No compiled runtime found. Call /compile first.", requestId: req.id },
      });
    }

    const [triggers, schedules, actions] = await Promise.all([
      prisma.runtimeTrigger.findMany({ where: { cloneId, companyId, enabled: true }, take: 100 }),
      prisma.runtimeSchedule.findMany({ where: { cloneId, companyId, enabled: true }, take: 50 }),
      prisma.runtimeAction.findMany({ where: { cloneId, companyId, enabled: true }, take: 100 }),
    ]);

    return reply.send({
      success: true,
      data: { state, triggers, schedules, actions },
      requestId: req.id,
    });
  });

  /**
   * POST /clones/:cloneId/wake
   * Manually wake a Clone with a reason and trigger.
   */
  app.post("/:companyId/runtime/clones/:cloneId/wake", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const body = wakeCloneSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid wake input", requestId: req.id },
      });
    }

    const result = await engine.wakeClone({
      cloneId,
      companyId,
      reason: body.data.reason,
      trigger: body.data.trigger,
      context: body.data.context,
    });

    return reply.status(201).send({ success: true, data: result, requestId: req.id });
  });

  /**
   * GET /clones/:cloneId/executions
   * List executions for a specific Clone.
   */
  app.get("/:companyId/runtime/clones/:cloneId/executions", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { status, limit } = req.query as Record<string, string>;
    const executions = await prisma.runtimeExecution.findMany({
      where: {
        companyId,
        cloneId,
        ...(status ? { status } : {}),
      },
      take: Math.min(Number(limit) || 20, 100),
    });

    return reply.send({ success: true, data: { executions }, requestId: req.id });
  });

  /**
   * GET /clones/:cloneId/schedules
   */
  app.get("/:companyId/runtime/clones/:cloneId/schedules", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const schedules = await prisma.runtimeSchedule.findMany({
      where: { cloneId, companyId },
      take: 50,
    });

    return reply.send({ success: true, data: { schedules }, requestId: req.id });
  });

  /**
   * GET /clones/:cloneId/commitments
   */
  app.get("/:companyId/runtime/clones/:cloneId/commitments", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { status } = req.query as Record<string, string>;
    const commitments = await prisma.runtimeCommitment.findMany({
      where: {
        companyId,
        cloneId,
        ...(status ? { status } : {}),
      },
      take: 50,
    });

    return reply.send({ success: true, data: { commitments }, requestId: req.id });
  });

  /**
   * GET /clones/:cloneId/status
   * Current runtime status snapshot for a Clone.
   */
  app.get("/:companyId/runtime/clones/:cloneId/status", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, cloneId } = req.params as { companyId: string; cloneId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const [clone, activeExec, openCommitments, openEscalations] = await Promise.all([
      prisma.aIEmployee.findFirst({ where: { id: cloneId, companyId } }),
      prisma.runtimeExecution.findFirst({
        where: {
          companyId,
          cloneId,
          status: ["QUEUED", "PLANNING", "EXECUTING", "WAITING_FOR_APPROVAL", "WAITING_FOR_AUTHORITY"],
        },
      }),
      prisma.runtimeCommitment.count({
        where: { companyId, cloneId, status: ["OPEN", "IN_PROGRESS", "BLOCKED", "OVERDUE"] },
      }),
      prisma.runtimeEscalation.count({ where: { companyId, cloneId, status: "OPEN" } }),
    ]);

    if (!clone) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Clone not found", requestId: req.id },
      });
    }

    return reply.send({
      success: true,
      data: {
        cloneId: clone.id,
        name: clone.name,
        role: clone.role,
        status: clone.status,
        activeExecution: activeExec
          ? {
              id: activeExec.id,
              status: activeExec.status,
              triggerSource: activeExec.triggerSource,
              startedAt: activeExec.startedAt,
            }
          : null,
        openCommitments,
        openEscalations,
      },
      requestId: req.id,
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // EXECUTIONS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /executions
   * All recent executions for the company.
   */
  app.get("/:companyId/runtime/executions", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { status, cloneId, limit } = req.query as Record<string, string>;
    const executions = await prisma.runtimeExecution.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
        ...(cloneId ? { cloneId } : {}),
      },
      include: { clone: true },
      take: Math.min(Number(limit) || 50, 200),
    });

    return reply.send({ success: true, data: { executions }, requestId: req.id });
  });

  /**
   * GET /executions/:executionId
   * Full detail with step log.
   */
  app.get("/:companyId/runtime/executions/:executionId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, executionId } = req.params as { companyId: string; executionId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const execution = await prisma.runtimeExecution.findFirst({
      where: { id: executionId, companyId },
      include: { clone: true },
    });

    if (!execution) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Execution not found", requestId: req.id },
      });
    }

    return reply.send({ success: true, data: { execution }, requestId: req.id });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SCHEDULES
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /schedules
   */
  app.get("/:companyId/runtime/schedules", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { enabled } = req.query as Record<string, string>;
    const schedules = await prisma.runtimeSchedule.findMany({
      where: {
        companyId,
        ...(enabled !== undefined ? { enabled: enabled === "true" } : {}),
      },
      take: 200,
    });

    return reply.send({ success: true, data: { schedules }, requestId: req.id });
  });

  /**
   * POST /schedules/:scheduleId/trigger
   * Manually fire a schedule immediately.
   */
  app.post("/:companyId/runtime/schedules/:scheduleId/trigger", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, scheduleId } = req.params as { companyId: string; scheduleId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    // Verify the schedule belongs to this company
    const schedule = await prisma.runtimeSchedule.findFirst({
      where: { id: scheduleId, companyId },
    });
    if (!schedule) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Schedule not found", requestId: req.id },
      });
    }

    // Use the engine's scheduler to fire it
    const runtimeEngine = getRuntimeEngine();
    // Access the scheduler via a dedicated method — fire directly via ingest
    const execution = await prisma.runtimeExecution.create({
      data: {
        companyId,
        cloneId: schedule.cloneId,
        status: "QUEUED",
        triggerSource: `manual:${schedule.taskType || schedule.name}`,
        input: { scheduleId, manual: true, taskPayload: schedule.taskPayload },
        startedAt: new Date(),
        stepLog: [{ step: 1, state: "QUEUED", timestamp: new Date(), details: `Manual trigger of schedule "${schedule.name}".` }],
      },
    });

    runtimeEngine.executeById(execution.id, companyId).catch(() => {});

    return reply.status(201).send({
      success: true,
      data: { executionId: execution.id, scheduleId },
      requestId: req.id,
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // COMMITMENTS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /commitments
   */
  app.get("/:companyId/runtime/commitments", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { status, cloneId } = req.query as Record<string, string>;
    const commitments = await prisma.runtimeCommitment.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
        ...(cloneId ? { cloneId } : {}),
      },
      include: { clone: true },
      take: 100,
    });

    return reply.send({ success: true, data: { commitments }, requestId: req.id });
  });

  /**
   * PATCH /commitments/:commitmentId
   */
  app.patch("/:companyId/runtime/commitments/:commitmentId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, commitmentId } = req.params as { companyId: string; commitmentId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const body = updateCommitmentSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid fields", requestId: req.id },
      });
    }

    const existing = await prisma.runtimeCommitment.findFirst({
      where: { id: commitmentId, companyId },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Commitment not found", requestId: req.id },
      });
    }

    const updated = await prisma.runtimeCommitment.update({
      where: { id: commitmentId },
      data: {
        ...(body.data.status ? { status: body.data.status } : {}),
        ...(body.data.description ? { description: body.data.description } : {}),
        ...(body.data.dueAt ? { dueAt: new Date(body.data.dueAt) } : {}),
        ...(body.data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });

    return reply.send({ success: true, data: { commitment: updated }, requestId: req.id });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ESCALATIONS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /escalations
   */
  app.get("/:companyId/runtime/escalations", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const { status } = req.query as Record<string, string>;
    const escalations = await prisma.runtimeEscalation.findMany({
      where: {
        companyId,
        status: status || "OPEN",
      },
      include: { clone: true },
      take: 100,
    });

    return reply.send({ success: true, data: { escalations }, requestId: req.id });
  });

  /**
   * POST /escalations/:escalationId/resolve
   */
  app.post("/:companyId/runtime/escalations/:escalationId/resolve", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId, escalationId } = req.params as { companyId: string; escalationId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const body = resolveEscalationSchema.safeParse(req.body);

    const existing = await prisma.runtimeEscalation.findFirst({
      where: { id: escalationId, companyId },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Escalation not found", requestId: req.id },
      });
    }

    await prisma.runtimeEscalation.update({
      where: { id: escalationId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedBy: req.user!.userId,
        notes: body.success ? body.data.notes : undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        companyId,
        actorName: req.user!.email,
        action: "ESCALATION_RESOLVED",
        resource: escalationId,
        details: `Escalation resolved by ${req.user!.email}. Notes: ${body.success ? (body.data.notes || "none") : "none"}`,
      },
    });

    return reply.send({ success: true, data: { resolved: true }, requestId: req.id });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // COMPILE ALL
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * POST /compile-all
   * Re-compile runtimes for all active Clones in the company.
   */
  app.post("/:companyId/runtime/compile-all", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const clones = await prisma.aIEmployee.findMany({
      where: { companyId, status: { $ne: "PAUSED" } as any },
    });

    const results: Array<{ cloneId: string; name: string; success: boolean; error?: string }> = [];

    for (const clone of clones as any[]) {
      try {
        await engine.compileCloneRuntime(clone.id, companyId);
        results.push({ cloneId: clone.id, name: clone.name, success: true });
      } catch (err: any) {
        results.push({ cloneId: clone.id, name: clone.name, success: false, error: err?.message });
      }
    }

    return reply.send({
      success: true,
      data: { compiled: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results },
      requestId: req.id,
    });
  });

  /**
   * POST /wake-all
   * Wake all active Clones in the company immediately (manual kickstart).
   */
  app.post("/:companyId/runtime/wake-all", { preHandler: [requireAuth] }, async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    if (!await guardCompany(companyId, req.user!.userId, reply, req.id)) return;

    const clones = await prisma.aIEmployee.findMany({
      where: { companyId, status: { $ne: "PAUSED" } as any },
    });

    const results: Array<{ cloneId: string; name: string; success: boolean; error?: string }> = [];

    for (const clone of clones as any[]) {
      const cid = clone.id || clone._id?.toString();
      try {
        await engine.wakeClone({
          cloneId: cid,
          companyId,
          reason: "Manual kickstart — waking all clones",
          trigger: { kind: "MANUAL", source: "manual" },
        });
        results.push({ cloneId: cid, name: clone.name, success: true });
      } catch (err: any) {
        results.push({ cloneId: cid, name: clone.name, success: false, error: err?.message });
      }
    }

    return reply.send({
      success: true,
      data: { woken: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length, results },
      requestId: req.id,
    });
  });
}
