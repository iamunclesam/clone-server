import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { AIEmployeeOrchestrator } from "@clone/ai-runtime";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  naturalPrompt: z.string().max(2000).optional(),
  assignedEmployeeId: z.string().optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional(),
  approvalRequired: z.boolean().optional(),
  maxExecutionTimeMs: z.number().min(5000).max(3600000).optional(),
});

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

export async function tasksRoutes(app: FastifyInstance) {
  const orchestrator = new AIEmployeeOrchestrator();

  // GET /companies/:companyId/tasks
  app.get("/:companyId/tasks", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { status, priority, employeeId } = request.query as Record<string, string>;
    const tasks = await prisma.task.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
        ...(priority ? { priority: priority as any } : {}),
        ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
      },
      include: { assignedEmployee: { select: { id: true, name: true, role: true, avatarUrl: true } }, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reply.send({ success: true, data: { tasks }, requestId: request.id });
  });

  // POST /companies/:companyId/tasks
  app.post("/:companyId/tasks", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    const body = createTaskSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid task fields", requestId: request.id } });

    const task = await prisma.task.create({ data: { companyId, ...body.data, dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined } });

    // If an employee is assigned and there's a natural prompt, trigger execution
    if (task.assignedEmployeeId && task.naturalPrompt) {
      const employee = await prisma.aIEmployee.findUnique({ where: { id: task.assignedEmployeeId }, include: { permissions: true } });
      if (employee && employee.companyId === companyId) {
        orchestrator.executeTask({
          companyId,
          employee: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
            personality: employee.personality,
            systemInstructions: employee.systemInstructions,
            permissions: employee.permissions.map((p: any) => ({ toolName: p.toolName, requiresApproval: p.requiresApproval, writeAccess: p.writeAccess })),
          },
          taskId: task.id,
          naturalPrompt: task.naturalPrompt,
        }).then(async (ctx) => {
          await prisma.task.update({ where: { id: task.id }, data: { status: ctx.currentState === "COMPLETED" ? "COMPLETED" : ctx.currentState === "WAITING_FOR_APPROVAL" ? "WAITING_FOR_APPROVAL" : "IN_PROGRESS" } });
        }).catch(() => {});
      }
    }

    await prisma.activityLog.create({ data: { companyId, actorName: request.user!.email, action: "TASK_CREATED", resource: task.title } });
    return reply.status(201).send({ success: true, data: { task }, requestId: request.id });
  });

  // GET /companies/:companyId/tasks/:taskId
  app.get("/:companyId/tasks/:taskId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, taskId } = request.params as { companyId: string; taskId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const task = await prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { assignedEmployee: true, executions: { orderBy: { startedAt: "desc" }, take: 5 }, approvals: { orderBy: { createdAt: "desc" }, take: 3 } },
    });
    if (!task) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Task not found", requestId: request.id } });
    return reply.send({ success: true, data: { task }, requestId: request.id });
  });

  // POST /companies/:companyId/tasks/:taskId/cancel
  app.post("/:companyId/tasks/:taskId/cancel", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, taskId } = request.params as { companyId: string; taskId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;
    await prisma.task.updateMany({ where: { id: taskId, companyId }, data: { status: "CANCELLED" } });
    return reply.send({ success: true, data: { status: "CANCELLED" }, requestId: request.id });
  });
}
