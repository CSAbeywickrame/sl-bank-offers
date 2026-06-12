import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformNdbScrape } from "@/lib/offers/ndbImport";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const reviewDate = "2026-06-12T00:00:00.000Z";
const scannedPath = join(process.cwd(), "data", "scanned-offers.json");
const seedPath = join(process.cwd(), "data", "seed.json");
const rawPath = join(process.cwd(), "data", "ndb-scrape-2026-06-12.json");

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as unknown;
const scannedCatalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const ndbOffers = transformNdbScrape(raw, reviewDate);
const nextScannedCatalog: ScannedOfferCatalog = {
  ...scannedCatalog,
  updatedAt: reviewDate,
  offers: [...scannedCatalog.offers.filter((offer) => offer.bankId !== "ndb"), ...ndbOffers]
};

const ndbCardIds = new Set(seed.cards.filter((card) => card.bankId === "ndb").map((card) => card.id));
const seedWithoutNdbOffers: SeedData = {
  ...seed,
  offers: seed.offers.filter((offer) => !ndbCardIds.has(offer.cardId))
};
const nextSeed = syncScannedOffers(seedWithoutNdbOffers, nextScannedCatalog);

writeFileSync(scannedPath, `${JSON.stringify(nextScannedCatalog, null, 2)}\n`, "utf8");
writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8");

console.log(`Imported ${ndbOffers.length} active NDB offers into scanned and seed catalogs.`);
