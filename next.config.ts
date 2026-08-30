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
      // Deliberately temporary (302). Nothing reads `type` yet — the offer-type filter arrives with
      // filters v2 — so today these land on the unfiltered homepage. A 301 would let browsers and
      // search engines cache that half-answer permanently; promote these to `permanent: true` in
      // the change that makes the param do something.
      { source: "/categories/installment", destination: "/?type=installment", permanent: false },
      { source: "/categories/cashback", destination: "/?type=cashback", permanent: false },
      { source: "/categories/bogo", destination: "/?type=bogo", permanent: false },
    ];
  },
};

export default nextConfig;
