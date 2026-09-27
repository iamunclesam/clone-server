import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const rawHost = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (isDev ? "http://localhost:4000" : "https://clone-server-9h5j.onrender.com")
).trim();

// Strip any trailing slashes and trailing /api/v1 so destination never duplicates /api/v1
const baseHost = rawHost.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${baseHost}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
