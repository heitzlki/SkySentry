import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore TypeScript errors in directories we don't control
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
