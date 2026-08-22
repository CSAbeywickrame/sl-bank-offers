import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/banks/standard-chartered", destination: "/banks", permanent: true },
      // Installment, cashback and BOGO stopped being categories and became offer types, so their
      // old category pages point at the equivalent filtered listing rather than 404ing on links
      // and search results that already exist out there.
      { source: "/categories/installment", destination: "/?type=installment", permanent: true },
      { source: "/categories/cashback", destination: "/?type=cashback", permanent: true },
      { source: "/categories/bogo", destination: "/?type=bogo", permanent: true },
    ];
  },
};

export default nextConfig;
