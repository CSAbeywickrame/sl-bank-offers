import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformNtbScrape } from "@/lib/offers/ntbImport";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { Card, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const reviewDate = "2026-06-10T00:00:00.000Z";
const scannedPath = join(process.cwd(), "data", "scanned-offers.json");
const seedPath = join(process.cwd(), "data", "seed.json");
const rawPath = join(process.cwd(), "data", "ntb-scrape-2026-06-10.json");

const privateBankingCard: Card = {
  id: "ntb-private-banking-mastercard-credit-cards",
  bankId: "ntb",
  name: "Nations Trust Bank Private Banking Mastercard Credit Cards",
  network: "Mastercard",
  tier: "Private Banking"
};

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as unknown;
const scannedCatalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const ntbOffers = transformNtbScrape(raw, reviewDate);
const nextScannedCatalog: ScannedOfferCatalog = {
  ...scannedCatalog,
  updatedAt: reviewDate,
  offers: [...scannedCatalog.offers.filter((offer) => offer.bankId !== "ntb"), ...ntbOffers]
};

const cards = seed.cards.some((card) => card.id === privateBankingCard.id) ? seed.cards : [...seed.cards, privateBankingCard];
const seedWithoutNtbOffers: SeedData = {
  ...seed,
  cards,
  offers: seed.offers.filter(
    (offer) =>
      offer.cardId !== "ntb-mastercard-credit-cards" &&
      offer.cardId !== "ntb-private-banking-mastercard-credit-cards"
  )
};
const nextSeed = syncScannedOffers(seedWithoutNtbOffers, nextScannedCatalog);

writeFileSync(scannedPath, `${JSON.stringify(nextScannedCatalog, null, 2)}\n`, "utf8");
writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8");

console.log(`Imported ${ntbOffers.length} active NTB offers into scanned and seed catalogs.`);
