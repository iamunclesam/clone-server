import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyCookie from "@fastify/cookie";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

import { connectToDatabase } from "@clone/database";
import { getRuntimeEngine } from "@clone/ai-runtime";

import { authRoutes } from "./modules/auth/auth.routes";
import { companiesRoutes } from "./modules/companies/companies.routes";
import { employeesRoutes } from "./modules/employees/employees.routes";
import { integrationsRoutes } from "./modules/integrations/integrations.routes";
import { tasksRoutes } from "./modules/tasks/tasks.routes";
import { workflowsRoutes } from "./modules/workflows/workflows.routes";
import { approvalsRoutes } from "./modules/approvals/approvals.routes";
import { activityRoutes } from "./modules/activity/activity.routes";
import { teamsRoutes } from "./modules/teams/teams.routes";
import { channelsRoutes } from "./modules/channels/channels.routes";
import { runtimeRoutes } from "./modules/runtime/runtime.routes";

const PORT = Number(process.env.PORT) || 4000;
const ALLOWED_ORIGINS = [process.env.ALLOWED_ORIGINS, process.env.WEB_URL, "http://localhost:3000"]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const UNIQUE_ORIGINS = [...new Set(ALLOWED_ORIGINS)];

export async function buildApp() {
  const app = Fastify({
    // Required so Secure cookies work behind Render/Vercel/nginx TLS termination.
    trustProxy: true,
    logger: {
      level: process.env.LOG_LEVEL || "info",
      redact: ["req.headers.authorization", "req.body.password", "req.body.token"],
    },
  });

  // Security Headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // CORS — strict allowlist only (same-origin proxy does not need this; keep for direct API tools)
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      let hostname = "";
      try {
        hostname = new URL(origin).hostname;
      } catch {
        cb(null, false);
        return;
      }
      const allowed =
        UNIQUE_ORIGINS.includes(origin) ||
        hostname === "localhost" ||
        hostname.endsWith(".vercel.app") ||
        hostname.endsWith(".onrender.com");
      cb(null, allowed);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // Cookies — parse only; Set-Cookie is written in auth routes (incl. Partitioned)
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "change-me-in-production",
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    },
  });

  // OpenAPI Docs
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "Clone AI OS API", version: "1.0.0", description: "Production API for Clone AI Employee Operating System" },
      components: {
        securitySchemes: {
          cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
        },
      },
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Route modules — all scoped under /api/v1
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(companiesRoutes, { prefix: "/api/v1/companies" });
  await app.register(employeesRoutes, { prefix: "/api/v1/companies" });
  await app.register(integrationsRoutes, { prefix: "/api/v1" });
  await app.register(tasksRoutes, { prefix: "/api/v1/companies" });
  await app.register(workflowsRoutes, { prefix: "/api/v1/companies" });
  await app.register(approvalsRoutes, { prefix: "/api/v1/companies" });
  await app.register(activityRoutes, { prefix: "/api/v1/companies" });
  await app.register(teamsRoutes, { prefix: "/api/v1/companies" });
  await app.register(channelsRoutes, { prefix: "/api/v1/companies" });
  await app.register(runtimeRoutes, { prefix: "/api/v1/companies" });

  // Global error handler — never leak internal stack traces
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    request.log.error({ err: error, requestId }, "Unhandled error");

    const statusCode = error.statusCode || 500;
    const isClientError = statusCode < 500;

    reply.status(statusCode).send({
      success: false,
      error: {
        code: isClientError ? "REQUEST_ERROR" : "INTERNAL_ERROR",
        message: isClientError ? error.message : "An unexpected error occurred",
        requestId,
      },
    });
  });

  return app;
}

async function main() {
  // Connect to MongoDB FIRST — before routes are hit
  await connectToDatabase();

  // Start the Runtime Engine (scheduler + background monitor)
  const engine = getRuntimeEngine();
  engine.start();

  const app = await buildApp();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`✅ Clone API running on http://0.0.0.0:${PORT}`);
  console.log(`📖 API Docs at http://localhost:${PORT}/docs`);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
