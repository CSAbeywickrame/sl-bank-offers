import type { ScannedOffer } from "@/lib/offers/types";
import type { SaveThumbnailResult } from "@/lib/ingest/images";
import { isAbsoluteHttpUrl } from "@/lib/offers/images";

/**
 * Turns the remote image URLs feed mappers emit into local thumbnails.
 *
 * Feed mappers can only know where a bank hosts a logo; the catalog must never point at it (no
 * hotlinking, and the bank can move or block the file). Everything here ends up either as a local
 * `/offer-images/...` url or with no imageUrl at all.
 */

// Remote source URL -> local thumbnail url, kept per bank in the refresh state so a weekly run does
// not re-download ~900 unchanged logos.
export type FeedImageCache = Record<string, string>;

export interface FeedImageDeps {
  // Downloads one image; resolves to undefined on any failure.
  fetchImage: (url: string) => Promise<Buffer | undefined>;
  saveThumbnail: (bytes: Buffer) => Promise<SaveThumbnailResult>;
  // True when a cached local thumbnail is still on disk (sweepOrphans may have removed it).
  thumbnailExists: (localUrl: string) => boolean;
}

export interface FeedImageResult {
  offers: ScannedOffer[];
  cache: FeedImageCache;
  resolved: number;
  failed: number;
}

// Where the catalog keeps local thumbnails; only urls under it count as a working prior image.
const LOCAL_IMAGE_PREFIX = "/offer-images/";
const CONCURRENCY = 6;

// Runs `task` over `items` with at most CONCURRENCY in flight.
async function forEachLimited<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}

// Resolves one remote url to a local thumbnail url, or undefined on any failure (never throws).
async function resolveOne(url: string, deps: FeedImageDeps): Promise<string | undefined> {
  try {
    const bytes = await deps.fetchImage(url);
    if (!bytes) return undefined;
    const saved = await deps.saveThumbnail(bytes);
    return saved.ok ? saved.url : undefined;
  } catch {
    return undefined;
  }
}

// Replaces every offer's remote imageUrl with a local thumbnail (one fetch per unique URL, cache
// first). An image that cannot be resolved falls back to the offer's prior local thumbnail when it
// is still on disk (so a transient CDN error doesn't wipe a working logo), else loses its imageUrl;
// a bad logo never fails the bank. The returned cache holds only this run's successes, so stale
// URLs drop out. `priorImageUrls` maps offer id -> the imageUrl its previous catalog row carried.
export async function resolveFeedImages(
  offers: ScannedOffer[],
  cache: FeedImageCache,
  priorImageUrls: Record<string, string>,
  deps: FeedImageDeps
): Promise<FeedImageResult> {
  const uniqueUrls = [...new Set(offers.map((offer) => offer.imageUrl).filter(isAbsoluteHttpUrl))];
  const nextCache: FeedImageCache = {};

  await forEachLimited(uniqueUrls, async (url) => {
    const cached = cache[url];
    const local = cached && deps.thumbnailExists(cached) ? cached : await resolveOne(url, deps);
    if (local) nextCache[url] = local;
  });

  const resolvedOffers = offers.map((offer) => {
    if (!isAbsoluteHttpUrl(offer.imageUrl)) return offer;
    const { imageUrl, ...rest } = offer;
    const prior = priorImageUrls[offer.id];
    const priorUsable = prior?.startsWith(LOCAL_IMAGE_PREFIX) && deps.thumbnailExists(prior) ? prior : undefined;
    const local = nextCache[imageUrl] ?? priorUsable;
    return local ? { ...rest, imageUrl: local } : rest;
  });

  return {
    offers: resolvedOffers,
    cache: nextCache,
    resolved: Object.keys(nextCache).length,
    failed: uniqueUrls.length - Object.keys(nextCache).length
  };
}
