import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

interface AliasEntry {
  canonical?: string;
}

/**
 * Alias merchant slugs, redirected to the merchant they actually name.
 *
 * Built here rather than inside the page. The mapping is fixed at build time, and a redirect
 * returned from a page render competes with Next.js prerendering the route as not-found — which is
 * what silently disabled it. A config redirect is unambiguous and cached correctly.
 */
function merchantAliasRedirects() {
  let aliases: Record<string, AliasEntry>;
  try {
    aliases = JSON.parse(readFileSync(join(process.cwd(), "data", "merchant-aliases.json"), "utf8")) as Record<string, AliasEntry>;
  } catch {
    return [];
  }

  const slug = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return Object.entries(aliases)
    .filter(([key, entry]) => !key.startsWith("_") && entry?.canonical)
    .map(([key, entry]) => ({
      source: `/merchants/${slug(key)}`,
      destination: `/merchants/${slug(entry.canonical as string)}`,
      permanent: true,
    }));
}

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
      ...merchantAliasRedirects(),
    ];
  },
};

export default nextConfig;
