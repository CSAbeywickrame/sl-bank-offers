import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/banks/standard-chartered", destination: "/banks", permanent: true },
    ];
  },
};

export default nextConfig;
