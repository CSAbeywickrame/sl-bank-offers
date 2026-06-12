import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformDfccScrape } from "@/lib/offers/dfccImport";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { Bank, Card, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const reviewDate = "2026-06-12T00:00:00.000Z";
const scannedPath = join(process.cwd(), "data", "scanned-offers.json");
const seedPath = join(process.cwd(), "data", "seed.json");
const rawPath = join(process.cwd(), "data", "dfcc-scrape-2026-06-12.json");

const dfccBank: Bank = {
  id: "dfcc",
  name: "DFCC Bank",
  shortName: "DFCC",
  websiteUrl: "https://www.dfcc.lk"
};

const dfccCards: Card[] = [
  {
    id: "dfcc-credit-cards",
    bankId: "dfcc",
    name: "DFCC Credit Cards",
    network: "Visa / Mastercard"
  }
];

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as unknown;
const scannedCatalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const dfccOffers = transformDfccScrape(raw, reviewDate);
const nextScannedCatalog: ScannedOfferCatalog = {
  ...scannedCatalog,
  updatedAt: reviewDate,
  offers: [...scannedCatalog.offers.filter((offer) => offer.bankId !== "dfcc"), ...dfccOffers]
};

const nextBanks = seed.banks.some((bank) => bank.id === dfccBank.id) ? seed.banks : [...seed.banks, dfccBank];
const nextCards = [...seed.cards];

for (const card of dfccCards) {
  if (!nextCards.some((existingCard) => existingCard.id === card.id)) {
    nextCards.push(card);
  }
}

const dfccCardIds = new Set(dfccCards.map((card) => card.id));
const seedWithoutDfccOffers: SeedData = {
  ...seed,
  banks: nextBanks,
  cards: nextCards,
  offers: seed.offers.filter((offer) => !dfccCardIds.has(offer.cardId))
};
const nextSeed = syncScannedOffers(seedWithoutDfccOffers, nextScannedCatalog);

writeFileSync(scannedPath, `${JSON.stringify(nextScannedCatalog, null, 2)}\n`, "utf8");
writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8");

console.log(`Imported ${dfccOffers.length} active DFCC offers into scanned and seed catalogs.`);
