import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  instructions: z.string().max(2000).optional(),
  leadEmployeeId: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  instructions: z.string().max(2000).optional(),
  leadEmployeeId: z.string().nullable().optional(),
});

const assignMembersSchema = z.object({
  employeeIds: z.array(z.string()).min(1),
});

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) {
    reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } });
    return null;
  }
  return m;
}

export async function teamsRoutes(app: FastifyInstance) {
  // GET /companies/:companyId/teams — List teams with assigned AI employees & team lead
  app.get("/:companyId/teams", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!(await guardCompanyAccess(companyId, request.user!.userId, reply, request.id))) return;

    const teamDocs = await prisma.team.findMany({ where: { companyId } });
    const allEmployees = await prisma.aIEmployee.findMany({ where: { companyId } });

    const teams = teamDocs.map((doc: any) => {
      const t = doc.toJSON ? doc.toJSON() : doc;
      const teamIdStr = t.id || t._id?.toString();
      
      const members = allEmployees
        .filter((e: any) => {
          const eObj = e.toJSON ? e.toJSON() : e;
          const empTeamId = eObj.teamId?._id?.toString() || eObj.teamId?.id || eObj.teamId?.toString();
          return empTeamId === teamIdStr;
        })
        .map((e: any) => {
          const eObj = e.toJSON ? e.toJSON() : e;
          return {
            id: eObj.id || eObj._id?.toString(),
            name: eObj.name,
            role: eObj.role,
            avatarUrl: eObj.avatarUrl,
            status: eObj.status,
          };
        });

      // Find designated team lead
      let leadObj = null;
      if (t.leadEmployeeId) {
        const leadEmp = allEmployees.find((e: any) => {
          const eObj = e.toJSON ? e.toJSON() : e;
          const eId = eObj.id || eObj._id?.toString();
          return eId === t.leadEmployeeId.toString();
        });
        if (leadEmp) {
          const lObj = leadEmp.toJSON ? leadEmp.toJSON() : leadEmp;
          leadObj = {
            id: lObj.id || lObj._id?.toString(),
            name: lObj.name,
            role: lObj.role,
            avatarUrl: lObj.avatarUrl,
          };
        }
      }

      // Fallback lead to first member if no explicit lead set
      const leadDisplay = leadObj
        ? `${leadObj.name} (${leadObj.role})`
        : members[0]
        ? `${members[0].name} (${members[0].role})`
        : "Unassigned";

      return {
        id: teamIdStr,
        companyId: t.companyId?.toString() || companyId,
        name: t.name,
        description: t.description || "",
        instructions: t.instructions || "",
        leadEmployeeId: t.leadEmployeeId?.toString() || leadObj?.id || null,
        leadEmployee: leadObj,
        members,
        memberCount: members.length,
        lead: leadDisplay,
        status: "ACTIVE",
        createdAt: t.createdAt,
      };
    });

    return reply.send({ success: true, data: { teams }, requestId: request.id });
  });

  // POST /companies/:companyId/teams — Create a new team
  app.post("/:companyId/teams", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (m.role === "VIEWER") {
      return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Viewers cannot create teams", requestId: request.id } });
    }

    const body = createTeamSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid team parameters", requestId: request.id } });
    }

    const teamDoc = await prisma.team.create({
      data: {
        companyId,
        name: body.data.name,
        description: body.data.description,
        instructions: body.data.instructions,
        leadEmployeeId: body.data.leadEmployeeId || undefined,
      },
    });

    const t = teamDoc.toJSON ? teamDoc.toJSON() : teamDoc;
    const teamIdStr = t.id || t._id?.toString();

    // Assign initial memberIds if provided
    if (body.data.memberIds && body.data.memberIds.length > 0) {
      for (const empId of body.data.memberIds) {
        await prisma.aIEmployee.update({
          where: { id: empId },
          data: { teamId: teamIdStr },
        });
      }
    }

    // Also ensure lead is assigned to team if leadEmployeeId specified
    if (body.data.leadEmployeeId) {
      await prisma.aIEmployee.update({
        where: { id: body.data.leadEmployeeId },
        data: { teamId: teamIdStr },
      });
    }

    // Fetch team with members
    const allEmployees = await prisma.aIEmployee.findMany({ where: { companyId } });
    const members = allEmployees
      .filter((e: any) => {
        const eObj = e.toJSON ? e.toJSON() : e;
        const empTeamId = eObj.teamId?._id?.toString() || eObj.teamId?.id || eObj.teamId?.toString();
        return empTeamId === teamIdStr;
      })
      .map((e: any) => {
        const eObj = e.toJSON ? e.toJSON() : e;
        return {
          id: eObj.id || eObj._id?.toString(),
          name: eObj.name,
          role: eObj.role,
          avatarUrl: eObj.avatarUrl,
          status: eObj.status,
        };
      });

    const team = {
      id: teamIdStr,
      companyId,
      name: t.name,
      description: t.description || "",
      instructions: t.instructions || "",
      leadEmployeeId: t.leadEmployeeId?.toString() || null,
      members,
      memberCount: members.length,
      lead: members[0] ? `${members[0].name} (${members[0].role})` : "Unassigned",
      status: "ACTIVE",
      createdAt: t.createdAt,
    };

    // Audit log
    await prisma.activityLog.create({
      data: {
        companyId,
        actorName: request.user!.email,
        action: "TEAM_CREATED",
        resource: team.name,
        details: `Created team '${team.name}'`,
      },
    });

    return reply.status(201).send({ success: true, data: { team }, requestId: request.id });
  });

  // POST /companies/:companyId/teams/:teamId/members — Assign existing employees to team
  app.post("/:companyId/teams/:teamId/members", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, teamId } = request.params as { companyId: string; teamId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    const body = assignMembersSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid employeeIds list", requestId: request.id } });
    }

    const teamDoc = await prisma.team.findUnique({ where: { id: teamId } });
    if (!teamDoc) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Team not found", requestId: request.id } });
    }

    for (const empId of body.data.employeeIds) {
      await prisma.aIEmployee.update({
        where: { id: empId },
        data: { teamId },
      });
    }

    // Audit log
    await prisma.activityLog.create({
      data: {
        companyId,
        actorName: request.user!.email,
        action: "TEAM_MEMBERS_ASSIGNED",
        resource: teamDoc.name,
        details: `Assigned ${body.data.employeeIds.length} employee(s) to team '${teamDoc.name}'`,
      },
    });

    return reply.send({ success: true, data: { message: "Employees assigned to team successfully" }, requestId: request.id });
  });

  // DELETE /companies/:companyId/teams/:teamId/members/:employeeId — Remove employee from team
  app.delete("/:companyId/teams/:teamId/members/:employeeId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, teamId, employeeId } = request.params as { companyId: string; teamId: string; employeeId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    await prisma.aIEmployee.update({
      where: { id: employeeId },
      data: { teamId: null },
    });

    return reply.send({ success: true, data: { message: "Employee removed from team" }, requestId: request.id });
  });

  // PATCH /companies/:companyId/teams/:teamId/lead — Assign/change Team Lead
  app.patch("/:companyId/teams/:teamId/lead", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, teamId } = request.params as { companyId: string; teamId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    const { leadEmployeeId } = (request.body as any) || {};
    if (!leadEmployeeId) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "leadEmployeeId is required", requestId: request.id } });
    }

    // Update team lead
    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { leadEmployeeId },
    });

    // Also ensure lead employee is assigned to this team
    await prisma.aIEmployee.update({
      where: { id: leadEmployeeId },
      data: { teamId },
    });

    return reply.send({ success: true, data: { team: updatedTeam }, requestId: request.id });
  });

  // PATCH /companies/:companyId/teams/:teamId — Update general team settings
  app.patch("/:companyId/teams/:teamId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, teamId } = request.params as { companyId: string; teamId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;

    const body = updateTeamSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid team update fields", requestId: request.id } });
    }

    const updatedDoc = await prisma.team.update({ where: { id: teamId }, data: body.data });
    if (!updatedDoc) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Team not found", requestId: request.id } });
    }

    const t = updatedDoc.toJSON ? updatedDoc.toJSON() : updatedDoc;
    return reply.send({ success: true, data: { team: { id: t.id || t._id?.toString(), ...body.data } }, requestId: request.id });
  });
}
