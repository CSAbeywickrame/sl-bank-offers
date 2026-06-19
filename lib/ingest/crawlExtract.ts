// lib/ingest/crawlExtract.ts
import { normalizeUrl } from "@/lib/ingest/crawlBank";
import type { ScannedOffer } from "@/lib/offers/types";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

export interface CrawlExtractDeps {
  discover: () => Promise<{ ok: boolean; urls?: string[]; error?: string }>;
  fetchDetail: (url: string) => Promise<{ ok: boolean; strippedText?: string; contentHash?: string; error?: string }>;
  extract: (sourceUrl: string, strippedText: string) => Promise<{ offers: ScannedOffer[]; inputTokens: number; outputTokens: number }>;
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
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Group a bank's existing scanned offers by normalized sourceUrl (the reuse source for unchanged pages).
export function groupOffersBySourceUrl(offers: ScannedOffer[]): Map<string, ScannedOffer[]> {
  const map = new Map<string, ScannedOffer[]>();
  for (const offer of offers) {
    let key: string;
    try {
      key = normalizeUrl(offer.sourceUrl);
    } catch {
      continue;
    }
    const arr = map.get(key) ?? [];
    arr.push(offer);
    map.set(key, arr);
  }
  return map;
}

// Crawl a bank's detail pages, extracting only new/changed pages (hash-gated) and reusing the rest.
export async function refreshCrawlBank(
  entry: BankRegistryEntry,
  snapshot: ScannedOffer[],
  prevHashes: Record<string, string>,
  reviewDateIso: string,
  deps: CrawlExtractDeps,
): Promise<CrawlExtractResult> {
  const throttleMs = deps.throttleMs ?? 0;
  const maxExtractions = deps.maxExtractions ?? Infinity;
  const base: CrawlExtractResult = {
    ok: false, offers: [], detailHashes: prevHashes,
    inputTokens: 0, outputTokens: 0, discovered: 0, extracted: 0, reused: 0,
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

  const keepPrior = (url: string, prior: ScannedOffer[]): void => {
    if (prior.length === 0) return;
    collected.push(...prior);
    reused += prior.length;
    if (prevHashes[url] !== undefined) nextHashes[url] = prevHashes[url];
  };

  for (const rawUrl of disc.urls) {
    const url = normalizeUrl(rawUrl);
    const prior = byUrl.get(url) ?? [];

    const fetched = await deps.fetchDetail(url);
    if (!fetched.ok || !fetched.strippedText) {
      keepPrior(url, prior);
      continue;
    }
    const hash = fetched.contentHash ?? "";

    if (prevHashes[url] !== undefined && prevHashes[url] === hash && prior.length > 0) {
      collected.push(...prior.map((o) => ({ ...o, lastReviewedAt: reviewDateIso })));
      reused += prior.length;
      nextHashes[url] = hash;
      continue;
    }

    if (extracted >= maxExtractions) {
      keepPrior(url, prior);
      continue;
    }

    if (throttleMs > 0) await sleep(throttleMs);
    const ex = await deps.extract(url, fetched.strippedText);
    inputTokens += ex.inputTokens;
    outputTokens += ex.outputTokens;
    extracted += 1;
    for (const offer of ex.offers) collected.push({ ...offer, sourceUrl: url });
    nextHashes[url] = hash;
  }

  const dedup = new Map<string, ScannedOffer>();
  for (const offer of collected) dedup.set(offer.id, offer);

  return {
    ok: true, offers: [...dedup.values()], detailHashes: nextHashes,
    inputTokens, outputTokens, discovered: disc.urls.length, extracted, reused,
  };
}
