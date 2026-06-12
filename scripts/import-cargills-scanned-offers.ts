import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformCargillsScrape } from "@/lib/offers/cargillsImport";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { Bank, Card, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const reviewDate = "2026-06-12T00:00:00.000Z";
const scannedPath = join(process.cwd(), "data", "scanned-offers.json");
const seedPath = join(process.cwd(), "data", "seed.json");
const rawPath = join(process.cwd(), "data", "cargills-scrape-2026-06-12.json");

const cargillsBank: Bank = {
  id: "cargills-bank",
  name: "Cargills Bank",
  shortName: "Cargills Bank",
  websiteUrl: "https://www.cargillsbank.com"
};

const cargillsCard: Card = {
  id: "cargills-bank-mastercard-credit-cards",
  bankId: "cargills-bank",
  name: "Cargills Bank Mastercard Credit Cards",
  network: "Mastercard"
};

const raw = JSON.parse(readFileSync(rawPath, "utf8")) as unknown;
const scannedCatalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const cargillsOffers = transformCargillsScrape(raw, reviewDate);
const nextScannedCatalog: ScannedOfferCatalog = {
  ...scannedCatalog,
  updatedAt: reviewDate,
  offers: [...scannedCatalog.offers.filter((offer) => offer.bankId !== "cargills-bank"), ...cargillsOffers]
};

const banks = seed.banks.some((bank) => bank.id === cargillsBank.id) ? seed.banks : [...seed.banks, cargillsBank];
const cards = seed.cards.some((card) => card.id === cargillsCard.id) ? seed.cards : [...seed.cards, cargillsCard];
const seedWithoutCargillsOffers: SeedData = {
  ...seed,
  banks,
  cards,
  offers: seed.offers.filter((offer) => offer.cardId !== cargillsCard.id)
};
const nextSeed = syncScannedOffers(seedWithoutCargillsOffers, nextScannedCatalog);

writeFileSync(scannedPath, `${JSON.stringify(nextScannedCatalog, null, 2)}\n`, "utf8");
writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8");

console.log(`Imported ${cargillsOffers.length} active Cargills Bank offers into scanned and seed catalogs.`);
