import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mergeOffers, readStoredOffers, writeStoredOffers } from "@/lib/ingest/persist";
import type { Offer } from "@/lib/offers/types";

const baseOffer = (overrides: Partial<Offer> = {}): Offer => ({
  id: "offer-1",
  bankId: "hnb",
  bankName: "Hatton National Bank",
  title: "Dining offer",
  category: "dining",
  description: "Discounts at selected restaurants",
  sourceUrl: "https://example.com/source",
  firstSeenAt: "2026-06-04T00:00:00.000Z",
  lastSeenAt: "2026-06-04T00:00:00.000Z",
  lastCheckedAt: "2026-06-04T00:00:00.000Z",
  status: "auto_published",
  rawSourceHash: "hash-1",
  ...overrides
});

let tempRoot = "";

afterEach(() => {
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = "";
  }
});

describe("mergeOffers", () => {
  it("adds new offers, updates existing ones, and preserves firstSeenAt", () => {
    const existing = [baseOffer({ firstSeenAt: "2026-06-01T00:00:00.000Z", lastSeenAt: "2026-06-01T00:00:00.000Z" })];
    const incoming = [
      baseOffer({ description: "Updated discounts", rawSourceHash: "hash-1b", lastCheckedAt: "2026-06-05T00:00:00.000Z" }),
      baseOffer({ id: "offer-2", title: "Hotel offer", category: "hotels", description: "Rooms", rawSourceHash: "hash-2" })
    ];

    const result = mergeOffers(existing, incoming, "2026-06-05T00:00:00.000Z");

    expect(result).toHaveLength(2);
    expect(result.find((offer) => offer.id === "offer-1")).toMatchObject({
      description: "Updated discounts",
      rawSourceHash: "hash-1b",
      firstSeenAt: "2026-06-01T00:00:00.000Z",
      lastSeenAt: "2026-06-05T00:00:00.000Z",
      lastCheckedAt: "2026-06-05T00:00:00.000Z",
      status: "auto_published"
    });
    expect(result.find((offer) => offer.id === "offer-2")).toMatchObject({
      firstSeenAt: "2026-06-05T00:00:00.000Z",
      lastSeenAt: "2026-06-05T00:00:00.000Z",
      status: "auto_published"
    });
  });

  it("marks missing offers inactive", () => {
    const existing = [baseOffer()];

    const result = mergeOffers(existing, [], "2026-06-05T00:00:00.000Z");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: "inactive",
      lastCheckedAt: "2026-06-05T00:00:00.000Z"
    });
  });

  it("marks expired offers when validUntil is in the past", () => {
    const existing = [baseOffer({ validUntil: "2026-06-01T00:00:00.000Z" })];

    const result = mergeOffers(existing, [baseOffer({ validUntil: "2026-06-01T00:00:00.000Z" })], "2026-06-05T00:00:00.000Z");

    expect(result[0]).toMatchObject({
      status: "expired",
      validUntil: "2026-06-01T00:00:00.000Z"
    });
  });

  it("keeps offers active through the end of a date-only validUntil value", () => {
    const result = mergeOffers([], [baseOffer({ validUntil: "2026-06-04" })], "2026-06-04T12:00:00.000Z");

    expect(result[0]).toMatchObject({
      status: "auto_published",
      validUntil: "2026-06-04"
    });
  });

  it("supports default read and write signatures without touching the repo data file", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "bank-offers-ingest-"));
    mkdirSync(join(tempRoot, "data"), { recursive: true });

    const previousCwd = process.cwd();
    process.chdir(tempRoot);
    try {
      const offers = [baseOffer({ id: "offer-default", rawSourceHash: "hash-default" })];
      writeStoredOffers(offers);

      expect(readFileSync(join(tempRoot, "data", "offers.json"), "utf8")).toContain("offer-default");
      expect(readStoredOffers()).toEqual(offers);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
