// lib/ingest/crawlExtract.ts
import * as cheerio from "cheerio";
import { normalizeUrl, normalizeAssetUrl, discoverDetailUrls, discoverAssetUrls } from "@/lib/ingest/crawlBank";
import type { CrawlRecipe, HtmlFetcher, DiscoveredAsset } from "@/lib/ingest/crawlBank";
import type { ImageMediaType } from "@/lib/ingest/fetchAndStrip";
import type { ScannedOffer } from "@/lib/offers/types";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

// Which fetch+extract branch a discovered URL should use, decided by the discovery step.
export type DiscoveredCrawlAssetType = "static_html" | "pdf" | "image";

// Strips a discovery-fetched page's raw HTML into the same {strippedText, contentHash} shape
// fetchDetail would produce for a static_html source. The hash MUST be computed over the stripped
// text via the same routine fetchAndStrip uses for static_html, so it stays comparable to hashes
// stored from a normal fetchDetail run — a different hash basis would invalidate every stored hash
// and force a full re-extraction.
export type DiscoveryStripper = (html: string) => { strippedText: string; contentHash: string };

export interface DiscoveredCrawlUrl {
  url: string;
  type: DiscoveredCrawlAssetType;
  // Pre-stripped text + content hash for this detail page, produced during discovery's own asset
  // scan of the page — only ever set for static_html detail pages, and only when a `stripHtml`
  // dep is supplied to discoverCrawlUrls. This lets refreshCrawlBank skip a second fetch of the
  // same URL (RC5: ntb's 115 re-fetches during discovery used to find zero assets) WITHOUT
  // retaining raw HTML for every discovered page — peoples-bank's 273 detail pages at ~240KB of
  // HTML each (~65MB, ~130MB resident as V8 UTF-16) is what OOM-killed a full run; stripped text
  // runs ~7KB/page instead (RC7).
  //
  // ogImageUrl is set from the same page-scan pass, but ONLY when the page has no image asset of
  // its own (see pageContentAssets/scanPageForAssets below) — the fallback creative for a detail
  // page whose offers would otherwise get no image at all.
  stripped?: { strippedText: string; contentHash: string; ogImageUrl?: string };
}

const CONTENT_IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i;

// True when an asset URL is worth sending to Claude vision: a real image file, not a data URI or an
// extension-less icon/tracking pixel. PDFs are never filtered here — they're high-signal by nature.
function isContentImage(url: string): boolean {
  if (url.startsWith("data:")) return false;
  try {
    return CONTENT_IMAGE_EXTENSIONS.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

// Discovered images smaller than this are icons/decoration, not offer banners — skipped before Claude
// vision to avoid wasted calls. Applies only to auto-discovered assets, never to explicit registry
// `image` sources (those are always sent, regardless of size, as long as they pass fetchAndStrip's own limits).
export const MIN_ASSET_IMAGE_BYTES = 10 * 1024;

// True when a fetched image's byte size is below MIN_ASSET_IMAGE_BYTES — an icon/decoration, not a real offer banner.
export function isUndersizedImage(type: DiscoveredCrawlAssetType, imageBytes?: Buffer): boolean {
  return type === "image" && (imageBytes?.length ?? 0) < MIN_ASSET_IMAGE_BYTES;
}

// Content-worthy PDF/image assets found in one page's own HTML, junk images already filtered — the
// pre-dedup form shared by discoverCrawlUrls' page scan and the og:image fallback below (which needs
// to know, before dedup, whether THIS page has an image asset of its own).
function pageContentAssets(html: string, baseUrl: string, assetHosts: string[]): DiscoveredAsset[] {
  return discoverAssetUrls(html, baseUrl, assetHosts).filter((asset) => asset.type !== "image" || isContentImage(asset.url));
}

// Folds a page's already-filtered assets into an existing seen-set + output array, deduped by url —
// shared by discoverCrawlUrls (page fetched fresh) and collectPageAssets (page already fetched).
function foldAssets(assets: DiscoveredAsset[], seen: Set<string>, out: DiscoveredCrawlUrl[]): void {
  for (const asset of assets) {
    if (seen.has(asset.url)) continue;
    seen.add(asset.url);
    out.push(asset);
  }
}

// Extracts an absolute og:image URL from a page's HTML, resolved against baseUrl — the fallback
// creative for a crawl detail page whose own HTML carries no offer-image asset of its own.
function extractOgImage(html: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(html);
  const content = $('meta[property="og:image"]').attr("content");
  if (!content) return undefined;
  try {
    return new URL(content, baseUrl).toString();
  } catch {
    return undefined;
  }
}

// Discovers a crawl bank's detail pages via the recipe's hops, plus any PDF/image assets linked
// directly from each seed page AND each discovered detail page. Merges both into one list — detail
// pages first, then assets — deduped by url, with junk images (data URIs / no image extension) dropped
// before they reach Claude vision. A page whose HTML can't be (re-)fetched for asset scanning is
// skipped, not fatal to the whole discover. When `stripHtml` is supplied, each discovered detail
// page's already-fetched HTML is stripped in place (never retained as raw HTML — see
// DiscoveredCrawlUrl.stripped) so refreshCrawlBank can skip a second fetch of the same URL (RC5).
// Without a stripper (e.g. the skipAssets isolation/perf path), a detail page is fetched twice
// across the whole pipeline (once here during discovery, once later via fetchDetail) — an accepted
// simplicity trade-off, not a bug.
export async function discoverCrawlUrls(
  seedUrls: string[],
  recipe: CrawlRecipe,
  fetchHtml: HtmlFetcher,
  assetHosts: string[] = [],
  skipAssets: boolean = false,
  stripHtml?: DiscoveryStripper,
): Promise<{ ok: boolean; urls?: DiscoveredCrawlUrl[]; error?: string }> {
  const disc = await discoverDetailUrls(seedUrls, recipe, fetchHtml);
  if (!disc.ok || !disc.urls) return { ok: false, error: disc.error };

  const urls: DiscoveredCrawlUrl[] = disc.urls.map((url) => ({ url, type: "static_html" as const }));
  // skipAssets short-circuits the asset re-scan below (perf/isolation runs) — no extra page re-fetches
  // happen, and no `html` is ever attached; refreshCrawlBank's fetchDetail fallback covers this case.
  if (skipAssets) return { ok: true, urls };

  const seen = new Set(urls.map((u) => u.url));

  // Fetches one page and folds its content-worthy assets into `urls`, deduped; a page whose HTML
  // can't be (re-)fetched is skipped, not fatal to the whole discover. When `target` is supplied
  // (the page IS one of our own discovered detail pages, not just a seed listing page) AND a
  // stripper was given, the fetched HTML is stripped immediately and only the stripped form is
  // stashed on it — never the raw HTML itself — so refreshCrawlBank can reuse it instead of
  // fetching the URL again (RC5) without the raw string surviving past this call (RC7). `html`
  // stays a plain local: nothing here closes over it beyond this synchronous use, so it's
  // collectable the moment this function returns.
  const scanPageForAssets = async (pageUrl: string, target?: DiscoveredCrawlUrl): Promise<void> => {
    let html: string;
    let normalized: string;
    try {
      normalized = normalizeUrl(pageUrl);
      html = await fetchHtml(normalized);
    } catch {
      return;
    }
    const pageAssets = pageContentAssets(html, normalized, assetHosts);
    if (target && stripHtml) {
      // Only fall back to the page's og:image when it has no image asset of its own — an asset
      // found here becomes its own separate offer-image via a later Claude vision extraction, so
      // using the og:image too would be a redundant (and possibly worse) second creative.
      const hasOwnImage = pageAssets.some((asset) => asset.type === "image");
      target.stripped = { ...stripHtml(html), ogImageUrl: hasOwnImage ? undefined : extractOgImage(html, normalized) };
    }
    foldAssets(pageAssets, seen, urls);
  };

  for (const seedUrl of seedUrls) await scanPageForAssets(seedUrl);
  for (const [i, detailUrl] of disc.urls.entries()) await scanPageForAssets(detailUrl, urls[i]);

  return { ok: true, urls };
}

// Discovers content-worthy PDF/image assets across already-fetched pages (rawHtml + its page URL),
// deduped by normalized URL, junk images filtered — the non-crawl counterpart of discoverCrawlUrls.
export function collectPageAssets(
  pages: { url: string; rawHtml: string }[],
  assetHosts: string[] = [],
): DiscoveredCrawlUrl[] {
  const seen = new Set<string>();
  const assets: DiscoveredCrawlUrl[] = [];
  for (const page of pages) {
    let baseUrl: string;
    try {
      baseUrl = normalizeUrl(page.url);
    } catch {
      continue;
    }
    foldAssets(pageContentAssets(page.rawHtml, baseUrl, assetHosts), seen, assets);
  }
  return assets;
}

// Content fetched for one discovered URL — only the fields matching its type are populated.
export interface FetchedCrawlContent {
  strippedText?: string;
  pdfBytes?: Buffer;
  imageBytes?: Buffer; // vision-ready bytes (already repaired/downscaled) when this asset is an image
  imageMediaType?: ImageMediaType;
  // The SAME image's original, un-repaired bytes — kept separately so a thumbnail can be
  // content-addressed to the source file rather than to its re-encoded vision copy.
  thumbnailBytes?: Buffer;
  // A static_html detail page's og:image, carried from discovery (see DiscoveredCrawlUrl.stripped)
  // for a page that has no image asset of its own — the caller's fallback offer-image source.
  ogImageUrl?: string;
}

export interface CrawlExtractDeps {
  discover: () => Promise<{ ok: boolean; urls?: DiscoveredCrawlUrl[]; error?: string }>;
  fetchDetail: (url: string, type: DiscoveredCrawlAssetType) => Promise<{
    ok: boolean;
    strippedText?: string;
    pdfBytes?: Buffer;
    imageBytes?: Buffer;
    imageMediaType?: ImageMediaType;
    thumbnailBytes?: Buffer;
    ogImageUrl?: string;
    contentHash?: string;
    error?: string;
  }>;
  extract: (sourceUrl: string, fetched: FetchedCrawlContent) => Promise<{ offers: ScannedOffer[]; inputTokens: number; outputTokens: number }>;
  throttleMs?: number;
  maxExtractions?: number;
  // Reports progress after each discovered URL is handled — lets a long crawl (hours, per bank) log
  // something before the very end (RC4). Optional so existing tests are unaffected.
  onProgress?: (done: number, total: number, extracted: number, failed: number) => void;
}

export interface CrawlExtractResult {
  ok: boolean;
  error?: string;
  offers: ScannedOffer[];
  detailHashes: Record<string, string>;
  inputTokens: number;
  outputTokens: number;
  discovered: number;
  extracted: number;
  reused: number;
  assetFailures: { url: string; reason: string }[];
  // Counts only failures from the catch around deps.extract — a fetch that succeeded but Claude
  // extraction itself threw. Distinct from assetFailures (which records BOTH fetch and extract
  // failures, with detail) so the caller can tell "every attempted extraction failed" (RC3: this
  // used to be invisible — a 100%-failing bank still reported status "updated" via keepPrior) from
  // "some pages just failed to fetch."
  extractFailures: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// True when a URL's pathname ends in a known asset extension (pdf/image) — used only to pick a stable
// dedup key for reusing prior offers, since a stored offer carries no explicit source type.
function looksLikeAssetUrl(url: string): boolean {
  try {
    return /\.(pdf|jpe?g|png|gif|webp)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

// Normalizes a URL for the reuse/dedup map only: asset-shaped URLs must not gain a forced trailing
// slash (that would corrupt a file path), everything else uses the existing page-normalization.
// This is a pure function of the URL string, so it's always self-consistent across runs regardless
// of whether it's applied to a freshly discovered URL or a previously stored offer's sourceUrl.
function normalizeForDedup(url: string): string {
  try {
    return looksLikeAssetUrl(url) ? normalizeAssetUrl(url) : normalizeUrl(url);
  } catch {
    return url;
  }
}

// Group a bank's existing scanned offers by normalized sourceUrl (the reuse source for unchanged pages).
export function groupOffersBySourceUrl(offers: ScannedOffer[]): Map<string, ScannedOffer[]> {
  const map = new Map<string, ScannedOffer[]>();
  for (const offer of offers) {
    let key: string;
    try {
      key = normalizeForDedup(offer.sourceUrl);
    } catch {
      continue;
    }
    const arr = map.get(key) ?? [];
    arr.push(offer);
    map.set(key, arr);
  }
  return map;
}

// Given a bank's prior offers grouped by normalized sourceUrl (see groupOffersBySourceUrl) and the
// list of asset/page URLs that were NOT successfully extracted this run (capped out, fetch failed, or
// extraction threw), returns the previously-stored offers to carry forward for those URLs — the
// non-crawl-branch counterpart of refreshCrawlBank's keepPrior, so a partial run in scripts/refresh.ts
// never silently drops a source's rows on the wholesale catalog replace.
export function carryForwardUnextractedOffers(
  priorOffersByUrl: Map<string, ScannedOffer[]>,
  unextractedUrls: string[],
): ScannedOffer[] {
  const carried: ScannedOffer[] = [];
  for (const url of unextractedUrls) {
    carried.push(...(priorOffersByUrl.get(normalizeForDedup(url)) ?? []));
  }
  return carried;
}

// Crawl a bank's detail pages/assets, extracting only new/changed ones (hash-gated) and reusing the rest.
export async function refreshCrawlBank(
  entry: BankRegistryEntry,
  snapshot: ScannedOffer[],
  prevHashes: Record<string, string>,
  reviewDateIso: string,
  deps: CrawlExtractDeps,
): Promise<CrawlExtractResult> {
  const throttleMs = deps.throttleMs ?? 0;
  const maxExtractions = deps.maxExtractions ?? Infinity;
  const assetFailures: { url: string; reason: string }[] = [];
  const base: CrawlExtractResult = {
    ok: false, offers: [], detailHashes: prevHashes,
    inputTokens: 0, outputTokens: 0, discovered: 0, extracted: 0, reused: 0, assetFailures, extractFailures: 0,
  };

  const disc = await deps.discover();
  if (!disc.ok || !disc.urls || disc.urls.length === 0) {
    return { ...base, error: disc.error ?? "no detail urls discovered" };
  }

  const byUrl = groupOffersBySourceUrl(snapshot);
  const nextHashes: Record<string, string> = {};
  const collected: ScannedOffer[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let extracted = 0;
  let reused = 0;
  let extractFailures = 0;

  const keepPrior = (dedupKey: string, prior: ScannedOffer[]): void => {
    if (prior.length === 0) return;
    collected.push(...prior);
    reused += prior.length;
    if (prevHashes[dedupKey] !== undefined) nextHashes[dedupKey] = prevHashes[dedupKey];
  };

  // Fetches/extracts one discovered URL. Broken out of the loop below purely so onProgress can fire
  // exactly once per URL regardless of which early-exit path it takes.
  const handleOne = async (discovered: DiscoveredCrawlUrl): Promise<void> => {
    // The URL actually fetched (and later stored as the offer's sourceUrl): normalized per its own
    // type so a pdf/image link never gains a corrupting trailing slash.
    const url = discovered.type === "static_html" ? normalizeUrl(discovered.url) : normalizeAssetUrl(discovered.url);
    const dedupKey = normalizeForDedup(discovered.url);
    const prior = byUrl.get(dedupKey) ?? [];

    let fetched: Awaited<ReturnType<CrawlExtractDeps["fetchDetail"]>>;
    if (discovered.stripped) {
      // Discovery already downloaded AND stripped this exact page while scanning it for assets —
      // reuse it instead of paying for a second outbound fetch of the same URL (RC5).
      fetched = { ok: true, ...discovered.stripped };
    } else {
      // Every outbound fetch to the bank's own server is throttled — an unthrottled burst is what
      // got www.combank.lk to 403 the rest of a crawl (RC6). The stripped-reuse branch above needs
      // no throttle: it makes no new request.
      if (throttleMs > 0) await sleep(throttleMs);
      fetched = await deps.fetchDetail(url, discovered.type);
    }

    const hasContent = Boolean(fetched.strippedText || fetched.pdfBytes || fetched.imageBytes);
    if (!fetched.ok) {
      assetFailures.push({ url, reason: fetched.error ?? "fetch failed" });
      keepPrior(dedupKey, prior);
      return;
    }
    if (!hasContent) {
      keepPrior(dedupKey, prior);
      return;
    }
    const hash = fetched.contentHash ?? "";

    if (prevHashes[dedupKey] !== undefined && prevHashes[dedupKey] === hash && prior.length > 0) {
      collected.push(...prior.map((o) => ({ ...o, lastReviewedAt: reviewDateIso })));
      reused += prior.length;
      nextHashes[dedupKey] = hash;
      return;
    }

    if (extracted >= maxExtractions) {
      keepPrior(dedupKey, prior);
      return;
    }

    let ex;
    try {
      ex = await deps.extract(url, {
        strippedText: fetched.strippedText,
        pdfBytes: fetched.pdfBytes,
        imageBytes: fetched.imageBytes,
        imageMediaType: fetched.imageMediaType,
        thumbnailBytes: fetched.thumbnailBytes,
        ogImageUrl: fetched.ogImageUrl,
      });
    } catch (err) {
      extractFailures += 1;
      assetFailures.push({ url, reason: err instanceof Error ? err.message : "extract failed" });
      keepPrior(dedupKey, prior);
      return;
    }
    inputTokens += ex.inputTokens;
    outputTokens += ex.outputTokens;
    extracted += 1;
    for (const offer of ex.offers) collected.push({ ...offer, sourceUrl: url });
    nextHashes[dedupKey] = hash;
  };

  for (const [i, discovered] of disc.urls.entries()) {
    await handleOne(discovered);
    deps.onProgress?.(i + 1, disc.urls.length, extracted, assetFailures.length);
  }

  const dedup = new Map<string, ScannedOffer>();
  for (const offer of collected) dedup.set(offer.id, offer);

  return {
    ok: true, offers: [...dedup.values()], detailHashes: nextHashes,
    inputTokens, outputTokens, discovered: disc.urls.length, extracted, reused, assetFailures, extractFailures,
  };
}
