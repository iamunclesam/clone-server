import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";

const createCompanySchema = z.object({
  name: z.string().min(2).max(80),
  companySize: z.string().max(20).optional(),
  companyType: z.string().max(40).optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  companySize: z.string().max(20).optional(),
  companyType: z.string().max(40).optional(),
  logoUrl: z.string().url().max(512).optional(),
});

async function assertCompanyMember(companyId: string, userId: string, reply: any, requestId: string) {
  const membership = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!membership) {
    reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied to this company", requestId } });
    return null;
  }
  return membership;
}

export async function companiesRoutes(app: FastifyInstance) {
  // GET /companies — list companies for current user
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: request.user!.userId },
    });

    const companies = (await Promise.all(memberships.map(async (m: any) => {
      const populated = (m.company && typeof m.company === "object" && m.company.name)
        ? m.company
        : (m.companyId && typeof m.companyId === "object" && m.companyId.name)
          ? m.companyId
          : null;
      const id = populated?.id || populated?._id?.toString() || (typeof m.companyId === "string" ? m.companyId : undefined);
      if (!id) return null;
      if (populated?.name) {
        return {
          id,
          name: populated.name,
          slug: populated.slug,
          companySize: populated.companySize,
          companyType: populated.companyType,
          logoUrl: populated.logoUrl,
          createdAt: populated.createdAt,
        };
      }
      const full = await prisma.company.findUnique({ where: { id } });
      if (!full) return null;
      return {
        id: full.id || id,
        name: full.name,
        slug: full.slug,
        companySize: full.companySize,
        companyType: full.companyType,
        logoUrl: full.logoUrl,
        createdAt: full.createdAt,
      };
    }))).filter(Boolean);

    return reply.send({ success: true, data: { companies }, requestId: request.id });
  });

  // POST /companies — create new workspace / company
  app.post("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = createCompanySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid workspace data", requestId: request.id } });

    const slug = body.data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
    const companyDoc = await prisma.company.create({ data: { name: body.data.name, slug, companySize: body.data.companySize, companyType: body.data.companyType } });
    
    const companyObj = companyDoc.toJSON ? companyDoc.toJSON() : companyDoc;
    const companyId = companyObj.id || companyObj._id?.toString();

    await prisma.membership.create({ data: { userId: request.user!.userId, companyId, role: "OWNER" } });

    // Seed default engineering team for the new company
    await prisma.team.create({
      data: {
        companyId,
        name: "Engineering & Product",
        description: "Core software development and task execution team.",
      },
    });

    const company = {
      id: companyId,
      name: companyObj.name,
      slug: companyObj.slug,
      companySize: companyObj.companySize,
      companyType: companyObj.companyType,
      logoUrl: companyObj.logoUrl,
      createdAt: companyObj.createdAt,
    };

    return reply.status(201).send({ success: true, data: { company }, requestId: request.id });
  });

  // GET /companies/:companyId
  app.get("/:companyId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await assertCompanyMember(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    const companyDoc = await prisma.company.findUnique({ where: { id: companyId } });
    if (!companyDoc) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Workspace not found", requestId: request.id } });

    const companyObj = companyDoc.toJSON ? companyDoc.toJSON() : companyDoc;
    const company = {
      id: companyObj.id || companyObj._id?.toString(),
      name: companyObj.name,
      slug: companyObj.slug,
      companySize: companyObj.companySize,
      companyType: companyObj.companyType,
      logoUrl: companyObj.logoUrl,
      createdAt: companyObj.createdAt,
    };

    return reply.send({ success: true, data: { company }, requestId: request.id });
  });

  // PATCH /companies/:companyId
  app.patch("/:companyId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await assertCompanyMember(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (!["OWNER", "ADMIN"].includes(m.role)) return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Only owners and admins can update company settings", requestId: request.id } });

    const body = updateCompanySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid update fields", requestId: request.id } });

    const updatedDoc = await prisma.company.update({ where: { id: companyId }, data: body.data });
    const companyObj = updatedDoc.toJSON ? updatedDoc.toJSON() : updatedDoc;
    const company = {
      id: companyObj.id || companyObj._id?.toString(),
      name: companyObj.name,
      slug: companyObj.slug,
      companySize: companyObj.companySize,
      companyType: companyObj.companyType,
      logoUrl: companyObj.logoUrl,
      createdAt: companyObj.createdAt,
    };

    return reply.send({ success: true, data: { company }, requestId: request.id });
  });
}
