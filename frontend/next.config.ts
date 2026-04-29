import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
