import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSampathScrape } from "@/lib/offers/sampathImport";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { Bank, Card, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const reviewDate = "2026-06-12T00:00:00.000Z";
const scannedPath = join(process.cwd(), "data", "scanned-offers.json");
const seedPath = join(process.cwd(), "data", "seed.json");
const rawPath = join(process.cwd(), "data", "sampath-scrape-2026-06-12.json");

const sampathBank: Bank = {
  id: "sampath",
  name: "Sampath Bank",
  shortName: "Sampath",
  websiteUrl: "https://www.sampath.lk"
};

const sampathCards: Card[] = [
  {
    id: "sampath-credit-cards",
    bankId: "sampath",
    name: "Sampath Credit Cards",
    network: "Visa / Mastercard / American Express"
  },
  {
    id: "sampath-premium-credit-cards",
    bankId: "sampath",
    name: "Sampath Visa Infinite, Visa Signature and Mastercard World Credit Cards",
    network: "Visa / Mastercard",
    tier: "Premium"
  }
];

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as unknown;
const scannedCatalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const sampathOffers = transformSampathScrape(raw, reviewDate);
const nextScannedCatalog: ScannedOfferCatalog = {
  ...scannedCatalog,
  updatedAt: reviewDate,
  offers: [...scannedCatalog.offers.filter((offer) => offer.bankId !== "sampath"), ...sampathOffers]
};

const nextBanks = seed.banks.some((bank) => bank.id === sampathBank.id) ? seed.banks : [...seed.banks, sampathBank];
const nextCards = [...seed.cards];

for (const card of sampathCards) {
  if (!nextCards.some((existingCard) => existingCard.id === card.id)) {
    nextCards.push(card);
  }
}

const sampathCardIds = new Set(sampathCards.map((card) => card.id));
const seedWithoutSampathOffers: SeedData = {
  ...seed,
  banks: nextBanks,
  cards: nextCards,
  offers: seed.offers.filter((offer) => !sampathCardIds.has(offer.cardId))
};
const nextSeed = syncScannedOffers(seedWithoutSampathOffers, nextScannedCatalog);

writeFileSync(scannedPath, `${JSON.stringify(nextScannedCatalog, null, 2)}\n`, "utf8");
writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8");

console.log(`Imported ${sampathOffers.length} active Sampath offers into scanned and seed catalogs.`);
