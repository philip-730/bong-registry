import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
