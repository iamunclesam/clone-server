import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { z } from "zod";

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

export async function approvalsRoutes(app: FastifyInstance) {
  // GET /companies/:companyId/approvals
  app.get("/:companyId/approvals", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const { status } = request.query as { status?: string };
    const approvals = await prisma.approvalRequest.findMany({
      where: { companyId, ...(status ? { status: status as any } : { status: "PENDING" }) },
      include: {
        employee: { select: { id: true, name: true, role: true, avatarUrl: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ success: true, data: { approvals }, requestId: request.id });
  });

  // POST /companies/:companyId/approvals/:approvalId/approve
  app.post("/:companyId/approvals/:approvalId/approve", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, approvalId } = request.params as { companyId: string; approvalId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (!["OWNER", "ADMIN", "MANAGER"].includes(m.role)) {
      return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Only owners, admins, and managers can approve actions", requestId: request.id } });
    }

    const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, companyId, status: "PENDING" } });
    if (!approval) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Pending approval not found", requestId: request.id } });

    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: "APPROVED", approvedByUserId: request.user!.userId, handledAt: new Date() },
    });

    // Execute approved high-risk tool action — supports all integration providers
    let executionResult: any = null;
    try {
      const { createDecipheriv, createCipheriv, randomBytes } = await import("crypto");
      const ENCRYPTION_KEY_HEX = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "0".repeat(64);

      let proposedParams: any = {};
      if (approval.proposedParams) {
        proposedParams = typeof approval.proposedParams === "string" ? JSON.parse(approval.proposedParams) : approval.proposedParams;
      }

      const toolName = approval.toolName || "";
      const providerFromTool = (typeof toolName === "string" && toolName.includes(".")) ? toolName.split(".")[0] : "";

      // Map provider -> search provider (handle aliases)
      const providerSearchMap: Record<string, string> = {
        gmail: "gmail",
        calendar: "calendar",
        notion: "notion",
        slack: "slack",
        linear: "linear",
        hubspot: "hubspot",
        github: "github",
      };
      const searchProvider = providerSearchMap[providerFromTool] || providerFromTool || "";

      if (searchProvider) {
        const connectedAccounts = await prisma.connectedAccount.findMany({
          where: { companyId, provider: searchProvider, status: "CONNECTED" },
        });

        if (connectedAccounts.length > 0) {
          const acc = connectedAccounts[0];

          // Decrypt access token using AES-256-GCM
          const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");
          let accessToken = "";
          let refreshToken = "";
          try {
            const buf = Buffer.from(acc.encryptedToken, "base64");
            const iv = buf.subarray(0, 16);
            const tag = buf.subarray(16, 32);
            const encrypted = buf.subarray(32);
            const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
            decipher.setAuthTag(tag);
            accessToken = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
          } catch {}

          // Decrypt refresh token
          if (acc.refreshToken) {
            try {
              const rbuf = Buffer.from(acc.refreshToken, "base64");
              const riv = rbuf.subarray(0, 16);
              const rtag = rbuf.subarray(16, 32);
              const renc = rbuf.subarray(32);
              const rdec = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, riv);
              rdec.setAuthTag(rtag);
              refreshToken = Buffer.concat([rdec.update(renc), rdec.final()]).toString("utf8");
            } catch {}
          }

          if (accessToken) {
            const { IntegrationRegistry } = await import("@clone/integration-framework");
            const registry = IntegrationRegistry.getInstance();
            const provider = registry.getProvider(searchProvider);
            if (provider) {
              // Build arguments from proposed params + tokens
              const toolArgs: Record<string, any> = {
                ...(proposedParams || {}),
                accessToken,
              };
              if (refreshToken) toolArgs.refreshToken = refreshToken;

              executionResult = await provider.executeTool({
                connectionId: acc.id,
                toolName,
                arguments: toolArgs,
                employeeId: approval.employeeId,
                companyId,
              });

              console.log(`🚀 Executed approved action ${toolName}:`, executionResult?.success ? "SUCCESS" : "FAILED", executionResult?.success ? "" : executionResult?.error);

              // If a fresh access token was obtained via refresh, persist it back to DB
              const freshToken = executionResult?.data?.freshToken;
              if (freshToken && typeof freshToken === "string" && freshToken !== accessToken) {
                try {
                  const newIv = randomBytes(16);
                  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, newIv);
                  const enc = Buffer.concat([cipher.update(freshToken, "utf8"), cipher.final()]);
                  const newEncryptedToken = Buffer.concat([newIv, cipher.getAuthTag(), enc]).toString("base64");
                  await prisma.connectedAccount.update({
                    where: { id: acc.id },
                    data: { encryptedToken: newEncryptedToken },
                  }).catch(() => null);
                  console.log(`🔑 Refreshed ${searchProvider} access token saved to DB for connection:`, acc.id);
                } catch {}
              }
            } else {
              console.warn(`Approval: No provider registered for "${searchProvider}"`);
            }
          } else {
            console.warn(`Approval: Could not decrypt access token for connection ${acc.id} (${searchProvider})`);
          }
        } else {
          console.warn(`Approval: No connected "${searchProvider}" accounts found for company ${companyId}`);
        }
      } else if (approval.actionName === "SEND_EMAIL_DISPATCH" && !toolName) {
        // Legacy fallback for old approval records without toolName
        const connectedAccounts = await prisma.connectedAccount.findMany({
          where: { companyId, provider: "gmail", status: "CONNECTED" },
        });
        if (connectedAccounts.length > 0 && proposedParams.to) {
          const acc = connectedAccounts[0];
          const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");
          const buf = Buffer.from(acc.encryptedToken, "base64");
          const iv = buf.subarray(0, 16);
          const tag = buf.subarray(16, 32);
          const encrypted = buf.subarray(32);
          const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
          decipher.setAuthTag(tag);
          const accessToken = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

          let refreshToken = "";
          if (acc.refreshToken) {
            try {
              const rbuf = Buffer.from(acc.refreshToken, "base64");
              const riv = rbuf.subarray(0, 16);
              const rtag = rbuf.subarray(16, 32);
              const renc = rbuf.subarray(32);
              const rdec = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, riv);
              rdec.setAuthTag(rtag);
              refreshToken = Buffer.concat([rdec.update(renc), rdec.final()]).toString("utf8");
            } catch {}
          }

          if (accessToken) {
            const { IntegrationRegistry } = await import("@clone/integration-framework");
            const registry = IntegrationRegistry.getInstance();
            const provider = registry.getProvider("gmail");
            if (provider) {
              executionResult = await provider.executeTool({
                connectionId: acc.id,
                toolName: "gmail.send_message",
                arguments: {
                  accessToken,
                  refreshToken,
                  to: proposedParams.to,
                  subject: proposedParams.subject || "Follow up",
                  body: proposedParams.body || "",
                },
                employeeId: approval.employeeId,
                companyId,
              });
              console.log("🚀 Executed legacy SEND_EMAIL_DISPATCH:", executionResult);

              const freshToken = executionResult?.data?.freshToken;
              if (freshToken) {
                const newIv = randomBytes(16);
                const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, newIv);
                const enc = Buffer.concat([cipher.update(freshToken, "utf8"), cipher.final()]);
                const newEncryptedToken = Buffer.concat([newIv, cipher.getAuthTag(), enc]).toString("base64");
                await prisma.connectedAccount.update({
                  where: { id: acc.id },
                  data: { encryptedToken: newEncryptedToken },
                }).catch(() => null);
                console.log("🔑 Refreshed Gmail access token saved (legacy path)");
              }
            }
          }
        }
      }
    } catch (execErr: any) {
      console.error("Error executing approved action:", execErr?.message || execErr);
    }

    await prisma.auditLog.create({ data: { companyId, userId: request.user!.userId, action: "APPROVAL_GRANTED", resource: approval.toolName, result: "SUCCESS", metadata: JSON.stringify({ approvalId, riskLevel: approval.riskLevel, executionResult }) } });

    return reply.send({ success: true, data: { status: "APPROVED", executionResult }, requestId: request.id });
  });

  // POST /companies/:companyId/approvals/:approvalId/reject
  app.post("/:companyId/approvals/:approvalId/reject", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, approvalId } = request.params as { companyId: string; approvalId: string };
    const m = await guardCompanyAccess(companyId, request.user!.userId, reply, request.id);
    if (!m) return;
    if (!["OWNER", "ADMIN", "MANAGER"].includes(m.role)) {
      return reply.status(403).send({ success: false, error: { code: "INSUFFICIENT_ROLE", message: "Only owners, admins, and managers can reject actions", requestId: request.id } });
    }

    const body = z.object({ reason: z.string().min(5).max(500) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Rejection reason required", requestId: request.id } });

    const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, companyId, status: "PENDING" } });
    if (!approval) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Pending approval not found", requestId: request.id } });

    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: "REJECTED", approvedByUserId: request.user!.userId, rejectionReason: body.data.reason, handledAt: new Date() },
    });

    await prisma.auditLog.create({ data: { companyId, userId: request.user!.userId, action: "APPROVAL_REJECTED", resource: approval.toolName, result: "SUCCESS", metadata: JSON.stringify({ approvalId, reason: body.data.reason }) } });

    return reply.send({ success: true, data: { status: "REJECTED" }, requestId: request.id });
  });
}
