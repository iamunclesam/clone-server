import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@clone/database";
import { signToken, requireAuth, sessionCookieOptions } from "../../middleware/auth";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

/** Normalize a Mongoose document to a plain object with `id` string field */
function toPlainUser(doc: any) {
  const obj = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: obj.id || obj._id?.toString(),
    email: obj.email,
    fullName: obj.fullName,
    avatarUrl: obj.avatarUrl ?? null,
    isEmailVerified: obj.isEmailVerified ?? false,
    createdAt: obj.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post("/register", async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid registration fields", requestId: request.id },
      });
    }

    const { email, password, fullName } = body.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: "EMAIL_TAKEN", message: "An account with this email already exists", requestId: request.id },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userDoc = await prisma.user.create({ data: { email, passwordHash, fullName } });
    const user = toPlainUser(userDoc);

    const token = signToken({ userId: user.id, email: user.email });
    reply.setCookie("session", token, sessionCookieOptions());

    return reply.status(201).send({ success: true, data: { user }, requestId: request.id });
  });

  // POST /auth/login
  app.post("/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid login fields", requestId: request.id },
      });
    }

    const { email, password } = body.data;
    const userDoc = await prisma.user.findUnique({ where: { email } });

    // Timing-safe: always run bcrypt even when user not found
    const hashToCheck = userDoc?.passwordHash || "$2b$12$invalidhashpadding000000000000000000000000000000000000000";
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!userDoc || !valid) {
      return reply.status(401).send({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password", requestId: request.id },
      });
    }

    const user = toPlainUser(userDoc);
    const token = signToken({ userId: user.id, email: user.email });
    reply.setCookie("session", token, sessionCookieOptions());

    return reply.send({ success: true, data: { user }, requestId: request.id });
  });

  // POST /auth/logout
  app.post("/logout", { preHandler: [requireAuth] }, async (request, reply) => {
    const { maxAge: _maxAge, ...clearOpts } = sessionCookieOptions();
    reply.clearCookie("session", clearOpts);
    return reply.send({ success: true, data: { message: "Logged out successfully" }, requestId: request.id });
  });

  // GET /auth/session
  app.get("/session", { preHandler: [requireAuth] }, async (request, reply) => {
    const userDoc = await prisma.user.findUnique({ where: { id: request.user!.userId } });
    if (!userDoc) {
      return reply.status(404).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found", requestId: request.id },
      });
    }
    const user = toPlainUser(userDoc);
    return reply.send({ success: true, data: { user }, requestId: request.id });
  });
}
