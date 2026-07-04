import * as cheerio from "cheerio";

// Normalize a URL for stable comparison/keys: lowercase host, strip fragment, single trailing slash on the path.
export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (!u.pathname.endsWith("/")) u.pathname = `${u.pathname}/`;
  return u.toString();
}

// Extract absolute, same-origin links from html whose `pathname + search` matches `pattern`,
// resolved against baseUrl, deduped + normalized.
export function extractLinks(html: string, baseUrl: string, pattern: RegExp): string[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.hostname.toLowerCase() !== base.hostname.toLowerCase()) return;
    if (!pattern.test(`${abs.pathname}${abs.search}`)) return;
    out.add(normalizeUrl(abs.toString()));
  });
  return [...out];
}

export interface CrawlRecipe {
  hops: string[];
  detailMatch: string;
  render?: "static" | "dynamic";
}

export interface DiscoverResult {
  ok: boolean;
  urls?: string[];
  error?: string;
}

export type HtmlFetcher = (url: string) => Promise<string>;

// Walks the index -> intermediate (hops) -> detail-page URLs. Never throws.
export async function discoverDetailUrls(
  seedUrls: string[],
  recipe: CrawlRecipe,
  fetchHtml: HtmlFetcher,
): Promise<DiscoverResult> {
  try {
    let pages = [...new Set(seedUrls.map(normalizeUrl))];
    for (const hop of recipe.hops) {
      const re = new RegExp(hop);
      const next = new Set<string>();
      for (const page of pages) {
        const html = await fetchHtml(page);
        for (const link of extractLinks(html, page, re)) next.add(link);
      }
      if (next.size === 0) return { ok: false, error: `no links matched hop ${hop}` };
      pages = [...next];
    }
    const detailRe = new RegExp(recipe.detailMatch);
    const details = new Set<string>();
    for (const page of pages) {
      const html = await fetchHtml(page);
      for (const link of extractLinks(html, page, detailRe)) details.add(link);
    }
    if (details.size === 0) return { ok: false, error: `no detail links matched ${recipe.detailMatch}` };
    return { ok: true, urls: [...details] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type DiscoveredAssetType = "pdf" | "image";

export interface DiscoveredAsset {
  url: string;
  type: DiscoveredAssetType;
}

// Normalizes an asset (PDF/image) file URL: lowercase host, strip fragment — unlike normalizeUrl,
// never appends a trailing slash, since that would corrupt a file path (e.g. "offers.pdf/" 404s).
export function normalizeAssetUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  return u.toString();
}

// Scans html for offer-bearing PDF links and image banners (nav/header/footer chrome excluded), resolved absolute + same-origin against baseUrl.
export function discoverAssetUrls(html: string, baseUrl: string): DiscoveredAsset[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  $("nav, header, footer").remove();
  const assets = new Map<string, DiscoveredAsset>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (abs.hostname.toLowerCase() !== base.hostname.toLowerCase()) return;
    if (!abs.pathname.toLowerCase().endsWith(".pdf")) return;
    const url = normalizeAssetUrl(abs.toString());
    assets.set(url, { url, type: "pdf" });
  });

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    let abs: URL;
    try {
      abs = new URL(src, base);
    } catch {
      return;
    }
    if (abs.hostname.toLowerCase() !== base.hostname.toLowerCase()) return;
    const url = normalizeAssetUrl(abs.toString());
    assets.set(url, { url, type: "image" });
  });

  return [...assets.values()];
}
