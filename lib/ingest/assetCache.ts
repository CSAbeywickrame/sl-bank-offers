// Cache of asset content-hashes that failed unrecoverably (an image that couldn't be decoded even
// tolerantly, or one Claude rejected after repair) — stops a refresh from re-spending an API call
// on the same permanently-bad file every run. Keyed by content hash rather than URL, so a bank
// re-uploading a fixed file under the same URL gets a fresh chance immediately.
export type FailedAssetCache = Record<string, string>; // contentHash -> ISO date of the failure

// Entries older than this are retried rather than trusted forever — an upstream file can get fixed.
export const FAILED_ASSET_TTL_DAYS = 30;

// True when failedAt is old enough that the entry should no longer count as a cache hit.
function isExpired(failedAtIso: string, nowIso: string): boolean {
  const ageMs = new Date(nowIso).getTime() - new Date(failedAtIso).getTime();
  return !Number.isFinite(ageMs) || ageMs > FAILED_ASSET_TTL_DAYS * 24 * 60 * 60 * 1000;
}

// True when hash is a live (non-expired) entry in the cache — the caller should skip extraction
// for it rather than spend another decode attempt or API call.
export function isAssetCacheHit(cache: FailedAssetCache | undefined, hash: string, nowIso: string): boolean {
  const failedAt = cache?.[hash];
  return failedAt !== undefined && !isExpired(failedAt, nowIso);
}

// Records (or refreshes) an unrecoverable failure for hash, returning a new cache object.
export function recordAssetFailure(cache: FailedAssetCache | undefined, hash: string, nowIso: string): FailedAssetCache {
  return { ...cache, [hash]: nowIso };
}

// Drops expired entries, plus any entry whose hash wasn't among this run's discoveredHashes — so a
// removed/fixed asset's entry doesn't linger forever and the cache can't grow unbounded.
//
// The "no longer discovered" rule is skipped entirely when discoveredHashes is empty: that means
// this run never got far enough to (re-)scan assets for the owning bank at all (e.g. an
// unchanged-content-hash short-circuit, or a deferred/no-API-key run) — not that every asset
// vanished. Pruning against an empty set in that case would wipe the whole cache for no reason.
export function pruneAssetCache(
  cache: FailedAssetCache | undefined,
  discoveredHashes: ReadonlySet<string>,
  nowIso: string,
): FailedAssetCache {
  if (!cache) return {};
  const pruned: FailedAssetCache = {};
  for (const [hash, failedAt] of Object.entries(cache)) {
    if (isExpired(failedAt, nowIso)) continue;
    if (discoveredHashes.size > 0 && !discoveredHashes.has(hash)) continue;
    pruned[hash] = failedAt;
  }
  return pruned;
}
