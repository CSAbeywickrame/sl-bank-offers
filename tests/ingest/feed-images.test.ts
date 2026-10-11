import { describe, expect, it, vi } from "vitest";
import { resolveFeedImages, type FeedImageDeps } from "@/lib/ingest/feedImages";
import type { ScannedOffer } from "@/lib/offers/types";

const offer = (id: string, imageUrl?: string): ScannedOffer => ({
  id,
  bankId: "hnb",
  cardId: "hnb-credit",
  title: id,
  category: "other",
  description: id,
  termsLink: "https://example.com",
  sourceUrl: "https://example.com",
  lastReviewedAt: "2026-10-10",
  status: "active",
  ...(imageUrl ? { imageUrl } : {})
});

const makeDeps = (overrides: Partial<FeedImageDeps> = {}): FeedImageDeps => ({
  fetchImage: vi.fn(async (url: string) => Buffer.from(url)),
  saveThumbnail: vi.fn(async (bytes: Buffer) => ({ ok: true, url: `/offer-images/${bytes.length}.webp` })),
  thumbnailExists: vi.fn(() => true),
  ...overrides
});

describe("resolveFeedImages", () => {
  it("fetches once per unique url and replaces the remote url with the local one", async () => {
    const deps = makeDeps();
    const result = await resolveFeedImages([offer("a", "https://x.test/1.png"), offer("b", "https://x.test/1.png")], {}, {}, deps);
    expect(deps.fetchImage).toHaveBeenCalledTimes(1);
    expect(result.offers.map((o) => o.imageUrl)).toEqual(["/offer-images/20.webp", "/offer-images/20.webp"]);
    expect(result.cache).toEqual({ "https://x.test/1.png": "/offer-images/20.webp" });
    expect(result.resolved).toBe(1);
  });

  it("reuses a cache hit when the thumbnail file is still on disk", async () => {
    const deps = makeDeps();
    const result = await resolveFeedImages([offer("a", "https://x.test/1.png")], { "https://x.test/1.png": "/offer-images/cached.webp" }, {}, deps);
    expect(deps.fetchImage).not.toHaveBeenCalled();
    expect(result.offers[0].imageUrl).toBe("/offer-images/cached.webp");
  });

  it("refetches a cache hit whose thumbnail file is missing", async () => {
    const deps = makeDeps({ thumbnailExists: vi.fn(() => false) });
    const result = await resolveFeedImages([offer("a", "https://x.test/1.png")], { "https://x.test/1.png": "/offer-images/gone.webp" }, {}, deps);
    expect(deps.fetchImage).toHaveBeenCalledTimes(1);
    expect(result.offers[0].imageUrl).toBe("/offer-images/20.webp");
  });

  it("drops imageUrl on fetch failure, thumbnail failure or a throw, never keeping a remote url", async () => {
    const deps = makeDeps({
      fetchImage: vi.fn(async (url: string) => {
        if (url.endsWith("throw")) throw new Error("boom");
        return url.endsWith("none") ? undefined : Buffer.from(url);
      }),
      saveThumbnail: vi.fn(async () => ({ ok: false, error: "bad" }))
    });
    const offers = [offer("a", "https://x.test/none"), offer("b", "https://x.test/throw"), offer("c", "https://x.test/ok")];
    const result = await resolveFeedImages(offers, {}, {}, deps);
    expect(result.offers.every((o) => o.imageUrl === undefined)).toBe(true);
    expect(result.offers.some((o) => "imageUrl" in o)).toBe(false);
    expect(result.cache).toEqual({});
    expect(result.failed).toBe(3);
  });

  it("rebuilds the cache from this run so stale urls drop out, and leaves imageless offers alone", async () => {
    const deps = makeDeps();
    const result = await resolveFeedImages([offer("a"), offer("b", "https://x.test/2.png")], { "https://old.test/z.png": "/offer-images/z.webp" }, {}, deps);
    expect(Object.keys(result.cache)).toEqual(["https://x.test/2.png"]);
    expect(result.offers[0].imageUrl).toBeUndefined();
  });

  it("falls back to the prior local thumbnail when the fetch fails and the file exists", async () => {
    const deps = makeDeps({ fetchImage: vi.fn(async () => undefined) });
    const result = await resolveFeedImages([offer("a", "https://x.test/1.png")], {}, { a: "/offer-images/prior.webp" }, deps);
    expect(result.offers[0].imageUrl).toBe("/offer-images/prior.webp");
    expect(result.cache).toEqual({});
  });

  it("does not fall back to a missing file or a non-local prior url", async () => {
    const failing = { fetchImage: vi.fn(async () => undefined) };
    const missing = makeDeps({ ...failing, thumbnailExists: vi.fn(() => false) });
    const r1 = await resolveFeedImages([offer("a", "https://x.test/1.png")], {}, { a: "/offer-images/prior.webp" }, missing);
    expect(r1.offers[0].imageUrl).toBeUndefined();
    const r2 = await resolveFeedImages([offer("a", "https://x.test/1.png")], {}, { a: "https://x.test/old.png" }, makeDeps(failing));
    expect(r2.offers[0].imageUrl).toBeUndefined();
  });
});
