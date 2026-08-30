import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/banks/standard-chartered", destination: "/banks", permanent: true },
      // Installment, cashback and BOGO stopped being categories and became offer types, so their
      // old category pages point at the equivalent filtered listing rather than 404ing on links
      // already in the wild.
      //
      // Permanent now that the offer-type filter reads `type` and these land on a real filtered
      // listing. They were 302s while the param did nothing, so no browser or crawler cached a
      // redirect to the unfiltered homepage.
      { source: "/categories/installment", destination: "/?type=installment", permanent: true },
      { source: "/categories/cashback", destination: "/?type=cashback", permanent: true },
      { source: "/categories/bogo", destination: "/?type=bogo", permanent: true },
    ];
  },
};

export default nextConfig;
