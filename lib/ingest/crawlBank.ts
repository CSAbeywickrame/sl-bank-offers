import * as cheerio from "cheerio";

// Normalize a URL for stable comparison/keys: lowercase host, strip fragment, single trailing slash on the path.
export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (!u.pathname.endsWith("/")) u.pathname = `${u.pathname}/`;
  return u.toString();
}

// Resolves an anchor's href against base, returning the absolute URL only if it parses and shares
// base's hostname — the shared same-origin gate behind both extractLinks and extractHrefsBySelector.
function resolveSameOriginHref(href: string | undefined, base: URL): URL | undefined {
  if (!href) return undefined;
  try {
    const abs = new URL(href, base);
    return abs.hostname.toLowerCase() === base.hostname.toLowerCase() ? abs : undefined;
  } catch {
    return undefined;
  }
}

// Extract absolute, same-origin links from html whose `pathname + search` matches `pattern`,
// resolved against baseUrl, deduped + normalized.
export function extractLinks(html: string, baseUrl: string, pattern: RegExp): string[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const abs = resolveSameOriginHref($(el).attr("href"), base);
    if (!abs || !pattern.test(`${abs.pathname}${abs.search}`)) return;
    out.add(normalizeUrl(abs.toString()));
  });
  return [...out];
}

// Extract absolute, same-origin, normalized hrefs from anchors matching a cheerio CSS selector —
// an alternative to extractLinks' regex match, for detail links marked by class/attribute rather
// than a URL pattern.
export function extractHrefsBySelector(html: string, baseUrl: string, selector: string): string[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $(selector).each((_, el) => {
    const abs = resolveSameOriginHref($(el).attr("href"), base);
    if (!abs) return;
    out.add(normalizeUrl(abs.toString()));
  });
  return [...out];
}

export interface CrawlRecipe {
  hops: string[];
  detailMatch?: string; // URL-pattern matcher for detail links (either this or detailSelector must be set)
  detailSelector?: string; // cheerio CSS selector for detail-page anchors, when links aren't a URL pattern
  paginateNextSelector?: string; // cheerio CSS selector for the "next page" link; when set, walk the pager
  render?: "static" | "dynamic";
}

export interface DiscoverResult {
  ok: boolean;
  urls?: string[];
  error?: string;
}

export type HtmlFetcher = (url: string) => Promise<string>;

const PAGINATION_HARD_CAP = 100;

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

    // A recipe must pick a matcher — without this guard, `new RegExp(undefined)` below would
    // silently compile to an empty pattern that matches every same-origin link.
    if (!recipe.detailSelector && !recipe.detailMatch) {
      return { ok: false, error: "crawl recipe defines neither detailMatch nor detailSelector" };
    }

    // Pulls detail links out of one already-fetched page's html, per the recipe's chosen matcher.
    const detailRe = recipe.detailSelector ? undefined : new RegExp(recipe.detailMatch!);
    const detailsFromHtml = (html: string, page: string): string[] =>
      recipe.detailSelector
        ? extractHrefsBySelector(html, page, recipe.detailSelector)
        : extractLinks(html, page, detailRe!);

    const details = new Set<string>();
    if (recipe.paginateNextSelector) {
      // Walk the pager from the current page frontier, fetching each page exactly once and reading
      // both its detail links and its next-page link off that single fetch. Loop-guarded by a visited
      // set (self/back-linking pagers) plus a hard cap, in case both somehow fail to catch a cycle.
      const visited = new Set<string>();
      const frontier = [...pages];
      while (frontier.length > 0 && visited.size < PAGINATION_HARD_CAP) {
        const page = frontier.shift()!;
        const key = normalizeUrl(page);
        if (visited.has(key)) continue;
        visited.add(key);
        const html = await fetchHtml(page);
        for (const link of detailsFromHtml(html, page)) details.add(link);
        const [nextPage] = extractHrefsBySelector(html, page, recipe.paginateNextSelector);
        if (nextPage && !visited.has(normalizeUrl(nextPage))) frontier.push(nextPage);
      }
    } else {
      for (const page of pages) {
        const html = await fetchHtml(page);
        for (const link of detailsFromHtml(html, page)) details.add(link);
      }
    }

    if (details.size === 0) {
      const error = recipe.detailSelector
        ? `no detail links matched selector ${recipe.detailSelector}`
        : `no detail links matched ${recipe.detailMatch}`;
      return { ok: false, error };
    }
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

// Scans html for offer-bearing PDF links and image banners (nav/header/footer chrome excluded),
// resolved absolute against baseUrl and restricted to the base hostname plus any hostname in
// `assetHosts` (for banks that serve offer creatives from a CDN/object-store host).
export function discoverAssetUrls(html: string, baseUrl: string, assetHosts: string[] = []): DiscoveredAsset[] {
  const base = new URL(baseUrl);
  const baseHost = base.hostname.toLowerCase();
  const allowedHosts = new Set([baseHost, ...assetHosts.map((h) => h.toLowerCase())]);
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
    if (!allowedHosts.has(abs.hostname.toLowerCase())) return;
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
    if (!allowedHosts.has(abs.hostname.toLowerCase())) return;
    const url = normalizeAssetUrl(abs.toString());
    assets.set(url, { url, type: "image" });
  });

  return [...assets.values()];
}
