import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/service/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:8000"}/service/:path*`,
      },
    ]
  },
};

export default nextConfig;
