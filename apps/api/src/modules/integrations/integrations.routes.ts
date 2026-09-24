import { FastifyInstance } from "fastify";
import { prisma } from "@clone/database";
import { requireAuth } from "../../middleware/auth";
import { IntegrationRegistry } from "@clone/integration-framework";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { z } from "zod";

const ENCRYPTION_KEY = Buffer.from(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "0".repeat(64), "hex");

function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

async function guardCompanyAccess(companyId: string, userId: string, reply: any, requestId: string) {
  const m = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) { reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Access denied", requestId } }); return null; }
  return m;
}

function isDemoConnectedAccount(connection: any): boolean {
  const token = String(connection?.encryptedToken || "");
  const name = String(connection?.accountName || "");
  const email = String(connection?.accountEmail || "");
  if (token.startsWith("enc_github_token") || token.startsWith("enc_slack_token") || token.startsWith("gho_mock_token_")) return true;
  if (name === "Acme-Org" || name === "Acme-GitHub-Org" || name === "Acme Workspace") return true;
  if (email === "devops@acme.com" || email === "bot@acme.slack.com") return true;
  return false;
}

function oauthRedirectUri(provider: string): string {
  const explicit = process.env[`${provider.toUpperCase()}_REDIRECT_URI`] || process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (explicit && provider === "github") return explicit;
  const apiUrl = process.env.API_URL || "http://localhost:4000";
  return `${apiUrl}/api/v1/integrations/${provider}/callback`;
}

export async function integrationsRoutes(app: FastifyInstance) {
  const registry = IntegrationRegistry.getInstance();

  // GET /companies/:companyId/integrations
  app.get("/companies/:companyId/integrations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const connections = await prisma.connectedAccount.findMany({ where: { companyId }, orderBy: { connectedAt: "desc" } });
    const live = [];
    for (const connection of connections || []) {
      if (isDemoConnectedAccount(connection)) {
        if (connection.status === "CONNECTED") {
          await prisma.connectedAccount.update({ where: { id: connection.id }, data: { status: "DISCONNECTED" } }).catch(() => null);
        }
        continue;
      }
      live.push(connection);
    }
    const catalog = [];
    for (const provider of registry.getAllProviders()) {
      const capabilities = await provider.getCapabilities("").catch(() => []);
      const connection = live.find(
        (c: any) => String(c.provider || "").toLowerCase() === provider.providerId && c.status === "CONNECTED"
      );
      catalog.push({
        providerId: provider.providerId,
        name: provider.name,
        description: provider.description,
        category: provider.category,
        capabilities,
        connected: Boolean(connection),
        connection: connection
          ? {
              id: connection.id,
              accountName: connection.accountName,
              accountEmail: connection.accountEmail,
              status: connection.status,
            }
          : null,
      });
    }
    return reply.send({ success: true, data: { connections: live, catalog }, requestId: request.id });
  });

  // POST /companies/:companyId/integrations/:provider/connect — initiate OAuth
  app.post("/companies/:companyId/integrations/:provider/connect", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, provider } = request.params as { companyId: string; provider: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const integrationProvider = registry.getProvider(provider);
    if (!integrationProvider) return reply.status(404).send({ success: false, error: { code: "PROVIDER_NOT_FOUND", message: `Integration "${provider}" is not supported`, requestId: request.id } });

    try {
      const stateToken = randomBytes(32).toString("hex");
      const redirectUri = oauthRedirectUri(provider);

      await prisma.oAuthState.create({ data: { stateToken, companyId, userId: request.user!.userId, provider, redirectUri, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });

      const authUrl = await integrationProvider.getAuthorizationUrl({ companyId, userId: request.user!.userId, redirectUri, state: stateToken });
      return reply.send({ success: true, data: { authorizationUrl: authUrl }, requestId: request.id });
    } catch (err: any) {
      request.log.error({ err }, "Failed to initiate OAuth");
      return reply.status(500).send({
        success: false,
        error: { code: "OAUTH_INIT_FAILED", message: err?.message || `Could not start ${provider} OAuth`, requestId: request.id },
      });
    }
  });

  // GET /integrations/:provider/callback
  app.get("/integrations/:provider/callback", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { code, state, error, error_description } = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    const webUrl = process.env.WEB_URL || "http://localhost:3000";

    if (error) {
      const errMsg = encodeURIComponent(error_description || error);
      return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=error&error=${errMsg}`);
    }

    if (!code || !state) {
      return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=error&error=Missing+OAuth+code+or+state`);
    }

    const oauthState = await prisma.oAuthState.findUnique({ where: { stateToken: state } });
    if (!oauthState || oauthState.expiresAt < new Date() || oauthState.provider !== provider) {
      return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=error&error=OAuth+state+is+invalid+or+expired`);
    }

    // Delete used state (prevent replay)
    await prisma.oAuthState.delete({ where: { stateToken: state } });

    const integrationProvider = IntegrationRegistry.getInstance().getProvider(provider);
    if (!integrationProvider) return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=error&error=Unknown+provider`);

    let result: Awaited<ReturnType<typeof integrationProvider.handleCallback>>;
    try {
      result = await integrationProvider.handleCallback({ code, state, redirectUri: oauthState.redirectUri });
    } catch (err: any) {
      const errMsg = encodeURIComponent(err?.message || "OAuth token exchange failed");
      return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=error&error=${errMsg}`);
    }
    const encryptedToken = encryptToken(result!.accessToken);

    const existing = await prisma.connectedAccount.findFirst({
      where: { companyId: oauthState.companyId, provider },
    });

    if (existing) {
      await prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          accountName: result!.accountName,
          accountEmail: result!.accountEmail,
          encryptedToken,
          refreshToken: result!.refreshToken ? encryptToken(result!.refreshToken) : null,
          scopes: result!.scopes.join(","),
          status: "CONNECTED",
        },
      });
    } else {
      await prisma.connectedAccount.create({
        data: {
          companyId: oauthState.companyId,
          provider,
          accountName: result!.accountName,
          accountEmail: result!.accountEmail,
          encryptedToken,
          refreshToken: result!.refreshToken ? encryptToken(result!.refreshToken) : null,
          scopes: result!.scopes.join(","),
          status: "CONNECTED",
        },
      });
    }

    await prisma.auditLog.create({ data: { companyId: oauthState.companyId, userId: oauthState.userId, action: "INTEGRATION_CONNECTED", resource: provider, result: "SUCCESS" } });

    return reply.redirect(`${webUrl}/integrations/callback?provider=${provider}&status=success`);
  });

  // POST /companies/:companyId/integrations/:connectionId/disconnect
  app.post("/companies/:companyId/integrations/:connectionId/disconnect", { preHandler: [requireAuth] }, async (request, reply) => {
    const { companyId, connectionId } = request.params as { companyId: string; connectionId: string };
    if (!await guardCompanyAccess(companyId, request.user!.userId, reply, request.id)) return;

    const connection = await prisma.connectedAccount.findFirst({ where: { id: connectionId, companyId } });
    if (!connection) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Connection not found", requestId: request.id } });

    await prisma.connectedAccount.update({ where: { id: connectionId }, data: { status: "DISCONNECTED" } });
    await prisma.auditLog.create({ data: { companyId, userId: request.user!.userId, action: "INTEGRATION_DISCONNECTED", resource: connection.provider, result: "SUCCESS" } });

    return reply.send({ success: true, data: { message: "Integration disconnected" }, requestId: request.id });
  });
}
