import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://clone-server-9h5j.onrender.com/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
