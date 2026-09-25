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
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    // Cross-site (Vercel page → Render API) requires None+Secure. Partitioned (CHIPS)
    // is required now that Chrome blocks unpartitioned third-party cookies.
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `session=${token}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (isProd) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  // Fastify 4 types have header(), not appendHeader()
  reply.header("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(reply: FastifyReply) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = ["session=", "Path=/", "HttpOnly", "Max-Age=0"];
  if (isProd) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  reply.header("Set-Cookie", parts.join("; "));
}

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
    return;
  }
}
