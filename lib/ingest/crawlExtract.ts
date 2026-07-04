// lib/ingest/crawlExtract.ts
import { normalizeUrl, normalizeAssetUrl, discoverDetailUrls, discoverAssetUrls } from "@/lib/ingest/crawlBank";
import type { CrawlRecipe, HtmlFetcher } from "@/lib/ingest/crawlBank";
import type { ImageMediaType } from "@/lib/ingest/fetchAndStrip";
import type { ScannedOffer } from "@/lib/offers/types";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

// Which fetch+extract branch a discovered URL should use, decided by the discovery step.
export type DiscoveredCrawlAssetType = "static_html" | "pdf" | "image";

export interface DiscoveredCrawlUrl {
  url: string;
  type: DiscoveredCrawlAssetType;
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

// Discovers a crawl bank's detail pages via the recipe's hops, plus any PDF/image assets linked
// directly from each seed page. Merges both into one list — detail pages first, then assets — deduped
// by url, with junk images (data URIs / no image extension) dropped before they reach Claude vision.
// A seed page whose HTML can't be fetched for asset scanning is skipped, not fatal to the whole discover.
export async function discoverCrawlUrls(
  seedUrls: string[],
  recipe: CrawlRecipe,
  fetchHtml: HtmlFetcher,
): Promise<{ ok: boolean; urls?: DiscoveredCrawlUrl[]; error?: string }> {
  const disc = await discoverDetailUrls(seedUrls, recipe, fetchHtml);
  if (!disc.ok || !disc.urls) return { ok: false, error: disc.error };

  const urls: DiscoveredCrawlUrl[] = disc.urls.map((url) => ({ url, type: "static_html" as const }));
  const seen = new Set(urls.map((u) => u.url));

  for (const seedUrl of seedUrls) {
    let html: string;
    let normalizedSeedUrl: string;
    try {
      normalizedSeedUrl = normalizeUrl(seedUrl);
      html = await fetchHtml(normalizedSeedUrl);
    } catch {
      continue;
    }
    for (const asset of discoverAssetUrls(html, normalizedSeedUrl)) {
      if (seen.has(asset.url)) continue;
      if (asset.type === "image" && !isContentImage(asset.url)) continue;
      seen.add(asset.url);
      urls.push(asset);
    }
  }

  return { ok: true, urls };
}

// Content fetched for one discovered URL — only the fields matching its type are populated.
export interface FetchedCrawlContent {
  strippedText?: string;
  pdfBytes?: Buffer;
  imageBytes?: Buffer;
  imageMediaType?: ImageMediaType;
}

export interface CrawlExtractDeps {
  discover: () => Promise<{ ok: boolean; urls?: DiscoveredCrawlUrl[]; error?: string }>;
  fetchDetail: (url: string, type: DiscoveredCrawlAssetType) => Promise<{
    ok: boolean;
    strippedText?: string;
    pdfBytes?: Buffer;
    imageBytes?: Buffer;
    imageMediaType?: ImageMediaType;
    contentHash?: string;
    error?: string;
  }>;
  extract: (sourceUrl: string, fetched: FetchedCrawlContent) => Promise<{ offers: ScannedOffer[]; inputTokens: number; outputTokens: number }>;
  throttleMs?: number;
  maxExtractions?: number;
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
    inputTokens: 0, outputTokens: 0, discovered: 0, extracted: 0, reused: 0, assetFailures,
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

  const keepPrior = (dedupKey: string, prior: ScannedOffer[]): void => {
    if (prior.length === 0) return;
    collected.push(...prior);
    reused += prior.length;
    if (prevHashes[dedupKey] !== undefined) nextHashes[dedupKey] = prevHashes[dedupKey];
  };

  for (const discovered of disc.urls) {
    // The URL actually fetched (and later stored as the offer's sourceUrl): normalized per its own
    // type so a pdf/image link never gains a corrupting trailing slash.
    const url = discovered.type === "static_html" ? normalizeUrl(discovered.url) : normalizeAssetUrl(discovered.url);
    const dedupKey = normalizeForDedup(discovered.url);
    const prior = byUrl.get(dedupKey) ?? [];

    const fetched = await deps.fetchDetail(url, discovered.type);
    const hasContent = Boolean(fetched.strippedText || fetched.pdfBytes || fetched.imageBytes);
    if (!fetched.ok) {
      assetFailures.push({ url, reason: fetched.error ?? "fetch failed" });
      keepPrior(dedupKey, prior);
      continue;
    }
    if (!hasContent) {
      keepPrior(dedupKey, prior);
      continue;
    }
    const hash = fetched.contentHash ?? "";

    if (prevHashes[dedupKey] !== undefined && prevHashes[dedupKey] === hash && prior.length > 0) {
      collected.push(...prior.map((o) => ({ ...o, lastReviewedAt: reviewDateIso })));
      reused += prior.length;
      nextHashes[dedupKey] = hash;
      continue;
    }

    if (extracted >= maxExtractions) {
      keepPrior(dedupKey, prior);
      continue;
    }

    if (throttleMs > 0) await sleep(throttleMs);
    const ex = await deps.extract(url, {
      strippedText: fetched.strippedText,
      pdfBytes: fetched.pdfBytes,
      imageBytes: fetched.imageBytes,
      imageMediaType: fetched.imageMediaType,
    });
    inputTokens += ex.inputTokens;
    outputTokens += ex.outputTokens;
    extracted += 1;
    for (const offer of ex.offers) collected.push({ ...offer, sourceUrl: url });
    nextHashes[dedupKey] = hash;
  }

  const dedup = new Map<string, ScannedOffer>();
  for (const offer of collected) dedup.set(offer.id, offer);

  return {
    ok: true, offers: [...dedup.values()], detailHashes: nextHashes,
    inputTokens, outputTokens, discovered: disc.urls.length, extracted, reused, assetFailures,
  };
}
