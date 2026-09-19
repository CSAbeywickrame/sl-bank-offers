import { describe, expect, it } from "vitest";
import { isAssetCacheHit, recordAssetFailure, pruneAssetCache, FAILED_ASSET_TTL_DAYS } from "@/lib/ingest/assetCache";

const NOW = "2026-06-15T00:00:00.000Z";

// Shifts NOW by the given number of days (negative = earlier).
function daysFromNow(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

describe("isAssetCacheHit", () => {
  it("is false when the hash has never failed", () => {
    expect(isAssetCacheHit(undefined, "abc123", NOW)).toBe(false);
    expect(isAssetCacheHit({}, "abc123", NOW)).toBe(false);
  });

  it("is true for a hash recorded as failed within the TTL window", () => {
    const cache = recordAssetFailure(undefined, "abc123", daysFromNow(-5));
    expect(isAssetCacheHit(cache, "abc123", NOW)).toBe(true);
  });

  it("is false once the entry is older than FAILED_ASSET_TTL_DAYS — an expired entry does not skip extraction", () => {
    const cache = recordAssetFailure(undefined, "abc123", daysFromNow(-(FAILED_ASSET_TTL_DAYS + 1)));
    expect(isAssetCacheHit(cache, "abc123", NOW)).toBe(false);
  });

  it("is still true right at the TTL boundary", () => {
    const cache = recordAssetFailure(undefined, "abc123", daysFromNow(-(FAILED_ASSET_TTL_DAYS - 1)));
    expect(isAssetCacheHit(cache, "abc123", NOW)).toBe(true);
  });

  it("only matches the exact hash, leaving other entries unaffected", () => {
    const cache = recordAssetFailure(undefined, "abc123", NOW);
    expect(isAssetCacheHit(cache, "different-hash", NOW)).toBe(false);
  });
});

describe("recordAssetFailure", () => {
  it("adds a new entry without mutating the input cache", () => {
    const original = { existing: daysFromNow(-1) };
    const updated = recordAssetFailure(original, "new-hash", NOW);

    expect(updated).toEqual({ existing: daysFromNow(-1), "new-hash": NOW });
    expect(original).toEqual({ existing: daysFromNow(-1) }); // unchanged
  });

  it("refreshes an existing entry's failure date rather than duplicating it", () => {
    const original = recordAssetFailure(undefined, "hash-1", daysFromNow(-20));
    const refreshed = recordAssetFailure(original, "hash-1", NOW);

    expect(refreshed).toEqual({ "hash-1": NOW });
  });
});

describe("pruneAssetCache", () => {
  it("returns an empty cache when given undefined", () => {
    expect(pruneAssetCache(undefined, new Set(["a"]), NOW)).toEqual({});
  });

  it("drops hashes no longer discovered this run, when discovery actually happened", () => {
    const cache = { "still-there": daysFromNow(-1), "gone-now": daysFromNow(-1) };

    const pruned = pruneAssetCache(cache, new Set(["still-there"]), NOW);

    expect(pruned).toEqual({ "still-there": daysFromNow(-1) });
  });

  it("drops expired entries even when they are still discovered this run", () => {
    const cache = { "expired-hash": daysFromNow(-(FAILED_ASSET_TTL_DAYS + 1)) };

    const pruned = pruneAssetCache(cache, new Set(["expired-hash"]), NOW);

    expect(pruned).toEqual({});
  });

  it("keeps every non-expired entry when discoveredHashes is empty (this run never scanned assets for the bank)", () => {
    const cache = { "hash-a": daysFromNow(-1), "hash-b": daysFromNow(-2) };

    const pruned = pruneAssetCache(cache, new Set(), NOW);

    expect(pruned).toEqual(cache);
  });
});
