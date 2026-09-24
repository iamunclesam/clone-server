import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

export async function activityRoutes(app: FastifyInstance) {
  // GET /companies/:companyId/activity
  app.get("/:companyId/activity", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { employeeId, action, limit } = request.query as Record<string, string>;
    const activities = await prisma.activityLog.findMany({
      where: {
        companyId,
        ...(employeeId ? { employeeId } : {}),
        ...(action ? { action } : {}),
      },
      include: { employee: { select: { id: true, name: true, role: true, avatarUrl: true } } },
      orderBy: { timestamp: "desc" },
      take: Math.min(Number(limit) || 50, 200),
    });
    return reply.send({ success: true, data: { activities }, requestId: request.id });
  });

  // GET /companies/:companyId/audit-logs
  app.get("/:companyId/audit-logs", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    // Only OWNER and ADMIN can read raw audit logs
    if (!["OWNER", "ADMIN"].includes(m.role)) {
      return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Only owners and admins can view audit logs", requestId: request.id } });
    }

    const { action, limit } = request.query as Record<string, string>;
    const logs = await prisma.auditLog.findMany({
      where: { companyId, ...(action ? { action } : {}) },
      orderBy: { timestamp: "desc" },
      take: Math.min(Number(limit) || 100, 500),
    });
    return reply.send({ success: true, data: { logs }, requestId: request.id });
  });
}
