import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

export function signToken(payload: AuthenticatedUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthenticatedUser {
  return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token =
    request.cookies?.session ||
    request.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: request.id },
    });
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch {
    reply.status(401).send({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Session expired or invalid", requestId: request.id },
    });
  }
}
