import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["mactan.tail7540fe.ts.net", "vegeta.tail7540fe.ts.net"],
  async rewrites() {
    return [
      {
        source: "/service/:path*",
        destination: "/api/service/:path*",
      },
    ]
  },
};

export default nextConfig;
