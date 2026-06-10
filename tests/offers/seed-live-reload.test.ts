import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeedData } from "@/lib/offers/types";

function createSeedData(offerIds: string[]): SeedData {
  return {
    banks: [
      {
        id: "commercial-bank",
        name: "Commercial Bank of Ceylon",
        shortName: "Commercial Bank",
        websiteUrl: "https://www.combank.lk"
      }
    ],
    cards: [
      {
        id: "commercial-bank-credit-cards",
        bankId: "commercial-bank",
        name: "Commercial Bank Credit Cards"
      }
    ],
    offers: offerIds.map((offerId) => ({
      id: offerId,
      cardId: "commercial-bank-credit-cards",
      title: offerId,
      category: "dining",
      description: `${offerId} description`,
      termsLink: `https://example.com/${offerId}/terms`,
      sourceUrl: `https://example.com/${offerId}`,
      lastReviewedAt: "2026-06-10T00:00:00.000Z",
      status: "active"
    }))
  };
}

function writeSeedFile(rootDir: string, seedData: SeedData): void {
  mkdirSync(join(rootDir, "data"), { recursive: true });
  writeFileSync(join(rootDir, "data", "seed.json"), `${JSON.stringify(seedData, null, 2)}\n`, "utf8");
}

describe("seed repository live reload", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
  });

  it("re-reads the latest seed file contents across repeated repository calls", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "cardcompass-seed-"));

    try {
      writeSeedFile(tempRoot, createSeedData(["offer-one"]));
      process.chdir(tempRoot);
      vi.resetModules();

      const { getSeedData } = await import("@/lib/offers/repository");
      expect((await getSeedData()).offers).toHaveLength(1);

      writeSeedFile(tempRoot, createSeedData(["offer-one", "offer-two"]));

      expect((await getSeedData()).offers).toHaveLength(2);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
