import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function backendOrigin(): string {
  const raw = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://clone-server-9h5j.onrender.com"
      : "http://localhost:4000")
  ).trim();
  return raw.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

function rewriteSetCookie(header: string): string {
  // Bind the session cookie to the web origin (first-party). Drop Domain so the
  // browser does not store it on the API host, which Chrome treats as a third-party cookie.
  return header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part))
    .map((part) => (/^samesite=/i.test(part) ? "SameSite=Lax" : part))
    .join("; ");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${backendOrigin()}/api/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of ["cookie", "content-type", "authorization", "accept", "accept-language"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_GATEWAY", message: "API unreachable" },
      },
      { status: 502 }
    );
  }

  const resHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) resHeaders.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) resHeaders.set("cache-control", cacheControl);
  const location = upstream.headers.get("location");
  if (location) resHeaders.set("location", location);

  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    resHeaders.append("set-cookie", rewriteSetCookie(cookie));
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
