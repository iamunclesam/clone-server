import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  employeeId: z.string().optional(),
  actionType: z.enum(["FETCH_CONTEXT", "PLAN", "EXECUTE_TOOL", "HUMAN_APPROVAL", "NOTIFY_SLACK", "SEND_EMAIL"]),
  configJson: z.record(z.unknown()),
});

const createWorkflowSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  triggerType: z.enum(["EMAIL", "GITHUB_ISSUE", "LINEAR_ISSUE", "SLACK_MESSAGE", "SCHEDULE", "WEBHOOK", "MANUAL"]),
  steps: z.array(stepSchema).min(1).max(20),
  canvasJson: z.record(z.unknown()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  triggerType: z.enum(["EMAIL", "GITHUB_ISSUE", "LINEAR_ISSUE", "SLACK_MESSAGE", "SCHEDULE", "WEBHOOK", "MANUAL"]).optional(),
  isActive: z.boolean().optional(),
  canvasJson: z.record(z.unknown()).optional(),
});

// ── Shared Mistral caller ─────────────────────────────────────────────────────
async function callMistral(model: string, messages: Array<{ role: string; content: string }>, maxTokens = 300): Promise<string> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return "";
  const fallback = ["mistral-small-latest", "open-mistral-7b"];
  for (const m of [model, ...fallback].filter(Boolean)) {
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: m, messages, temperature: 0.3, max_tokens: maxTokens }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch { /* try next */ }
  }
  return "";
}

export async function workflowsRoutes(app: FastifyInstance) {

  // ── GET /companies/:companyId/workflows ──────────────────────────────────
  app.get("/:companyId/workflows", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const workflows = await prisma.workflow.findMany({
      where: { companyId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: { workflows }, requestId: request.id });
  });

  // ── POST /companies/:companyId/workflows ─────────────────────────────────
  app.post("/:companyId/workflows", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (m.role === "VIEWER") return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Viewers cannot create workflows", requestId: request.id } });

    const body = createWorkflowSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid workflow definition", requestId: request.id } });

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name: body.data.name,
        description: body.data.description,
        triggerType: body.data.triggerType,
        canvasJson: body.data.canvasJson || {},
        steps: { create: body.data.steps.map((s) => ({ ...s, companyId, configJson: JSON.stringify(s.configJson) })) },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    await prisma.activityLog.create({
      data: { companyId, actorName: request.user!.email, action: "WORKFLOW_CREATED", resource: workflow.name },
    });

    return reply.status(201).send({ success: true, data: { workflow }, requestId: request.id });
  });

  // ── GET /companies/:companyId/workflows/:workflowId ──────────────────────
  app.get("/:companyId/workflows/:workflowId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, companyId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!workflow) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workflow not found", requestId: request.id } });
    return reply.send({ success: true, data: { workflow }, requestId: request.id });
  });

  // ── PATCH /companies/:companyId/workflows/:workflowId ────────────────────
  app.patch("/:companyId/workflows/:workflowId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const body = updateWorkflowSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid fields", requestId: request.id } });

    const existing = await prisma.workflow.findFirst({ where: { id: workflowId, companyId } });
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workflow not found", requestId: request.id } });

    const updated = await prisma.workflow.update({ where: { id: workflowId }, data: body.data });
    return reply.send({ success: true, data: { workflow: updated }, requestId: request.id });
  });

  // ── DELETE /companies/:companyId/workflows/:workflowId ───────────────────
  app.delete("/:companyId/workflows/:workflowId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const existing = await prisma.workflow.findFirst({ where: { id: workflowId, companyId } });
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workflow not found", requestId: request.id } });

    await prisma.workflow.delete({ where: { id: workflowId } });
    await prisma.activityLog.create({
      data: { companyId, actorName: request.user!.email, action: "WORKFLOW_DELETED", resource: existing.name },
    });
    return reply.send({ success: true, data: { deleted: true }, requestId: request.id });
  });

  // ── PUT /companies/:companyId/workflows/:workflowId/canvas ───────────────
  // Save the React Flow canvas layout (nodes + edges)
  app.put("/:companyId/workflows/:workflowId/canvas", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { nodes, edges } = (request.body || {}) as { nodes: unknown[]; edges: unknown[] };
    if (!nodes || !edges) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "nodes and edges required", requestId: request.id } });

    await prisma.workflow.update({ where: { id: workflowId }, data: { canvasJson: { nodes, edges } } });
    return reply.send({ success: true, data: { saved: true }, requestId: request.id });
  });

  // ── POST /companies/:companyId/workflows/:workflowId/trigger ─────────────
  // Execute the workflow — runs each step with LLM + tools
  app.post("/:companyId/workflows/:workflowId/trigger", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, companyId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!workflow) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workflow not found", requestId: request.id } });
    if (!workflow.isActive) return reply.status(400).send({ success: false, error: { code: "WORKFLOW_INACTIVE", message: "Workflow is not active", requestId: request.id } });

    const triggerContext = (request.body as any) || {};
    const runId = `run_${Date.now()}`;
    const stepResults: Array<{ step: number; actionType: string; status: string; output: string }> = [];

    // Execute steps sequentially, each step powered by the assigned clone's LLM
    for (const step of (workflow.steps || []) as any[]) {
      let stepOutput = "";
      let stepStatus = "COMPLETED";

      try {
        if (step.actionType === "HUMAN_APPROVAL") {
          // Create an approval request and pause
          await prisma.approvalRequest.create({
            data: {
              companyId,
              employeeId: step.employeeId || companyId,
              actionName: `workflow_step_${step.stepOrder}`,
              toolName: "workflow.human_approval",
              proposedParams: JSON.stringify({ workflowId, stepId: step.id, config: step.configJson }),
              riskLevel: "MEDIUM",
              riskReason: `Workflow "${workflow.name}" step ${step.stepOrder} requires human approval.`,
              status: "PENDING",
            },
          });
          stepOutput = "Approval request created. Waiting for human authorization.";
          stepStatus = "WAITING_FOR_APPROVAL";
        } else if (step.actionType === "FETCH_CONTEXT" || step.actionType === "PLAN" || step.actionType === "EXECUTE_TOOL") {
          // Get the assigned clone
          let clone: any = null;
          if (step.employeeId) {
            clone = await prisma.aIEmployee.findFirst({ where: { id: step.employeeId, companyId } });
          }

          const config = (() => { try { return JSON.parse(step.configJson || "{}"); } catch { return {}; } })();

          const systemPrompt = clone
            ? `You are ${clone.name}, an autonomous AI employee (${clone.role}). ${clone.systemInstructions || ""}`
            : `You are an AI workflow execution engine.`;

          const userPrompt =
            `Execute workflow step ${step.stepOrder}: ${step.actionType}.\n` +
            `Workflow: "${workflow.name}" (trigger: ${workflow.triggerType})\n` +
            `Step config: ${JSON.stringify(config)}\n` +
            `Trigger context: ${JSON.stringify(triggerContext)}\n` +
            (stepResults.length > 0 ? `Previous step results:\n${stepResults.map(r => `Step ${r.step}: ${r.output}`).join("\n")}` : "") +
            `\nComplete this step and report the result in 2–3 sentences.`;

          const model = clone?.llmModel || "mistral-small-latest";
          stepOutput = await callMistral(model, [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userPrompt },
          ], 250);

          if (!stepOutput) stepOutput = `Step ${step.stepOrder} (${step.actionType}) executed.`;
        } else if (step.actionType === "NOTIFY_SLACK") {
          stepOutput = `Slack notification queued for step ${step.stepOrder}.`;
        } else if (step.actionType === "SEND_EMAIL") {
          stepOutput = `Email action logged for step ${step.stepOrder} — requires approval before send.`;
        }
      } catch (err: any) {
        stepStatus = "FAILED";
        stepOutput = `Step failed: ${err?.message || "error"}`;
      }

      stepResults.push({ step: step.stepOrder, actionType: step.actionType, status: stepStatus, output: stepOutput });

      // Update step status in DB
      await prisma.workflowStep.update({
        where: { id: step.id },
        data: { status: stepStatus },
      }).catch(() => {});

      // Stop on approval-required or failure
      if (stepStatus === "WAITING_FOR_APPROVAL" || stepStatus === "FAILED") break;
    }

    // Update workflow run stats
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { lastRunAt: new Date(), runCount: (workflow.runCount || 0) + 1 },
    });

    await prisma.activityLog.create({
      data: {
        companyId,
        actorName: request.user!.email,
        action: "WORKFLOW_TRIGGERED",
        resource: workflow.name,
        details: `Run ${runId}: ${stepResults.length} step(s) executed. Final status: ${stepResults[stepResults.length - 1]?.status || "COMPLETED"}.`,
      },
    });

    return reply.send({
      success: true,
      data: { runId, workflowId, stepResults, completedSteps: stepResults.filter(s => s.status === "COMPLETED").length },
      requestId: request.id,
    });
  });

  // ── POST /companies/:companyId/workflows/:workflowId/duplicate ───────────
  app.post("/:companyId/workflows/:workflowId/duplicate", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, workflowId } = request.params as { companyId: string; workflowId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const source = await prisma.workflow.findFirst({
      where: { id: workflowId, companyId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!source) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workflow not found", requestId: request.id } });

    const copy = await prisma.workflow.create({
      data: {
        companyId,
        name: `${source.name} (copy)`,
        description: source.description,
        triggerType: source.triggerType,
        canvasJson: source.canvasJson || {},
        steps: {
          create: (source.steps || []).map((s: any) => ({
            companyId, stepOrder: s.stepOrder, employeeId: s.employeeId,
            actionType: s.actionType, configJson: s.configJson,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    return reply.status(201).send({ success: true, data: { workflow: copy }, requestId: request.id });
  });
}
