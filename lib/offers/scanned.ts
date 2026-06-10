import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Bank, Card, ScannedOffer, ScannedOfferCatalog, SeedData } from "./types";
import { offerCategories } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertScannedOffer(value: unknown): asserts value is ScannedOffer {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.bankId !== "string" ||
    typeof value.cardId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.category !== "string" ||
    !offerCategories.includes(value.category as (typeof offerCategories)[number]) ||
    typeof value.description !== "string" ||
    typeof value.termsLink !== "string" ||
    typeof value.sourceUrl !== "string" ||
    typeof value.lastReviewedAt !== "string" ||
    typeof value.status !== "string"
  ) {
    throw new Error("Scanned offer entries must include bank, card, category, terms, source, and review metadata.");
  }
}

function assertScannedOfferCatalog(value: unknown): asserts value is ScannedOfferCatalog {
  if (!isRecord(value) || typeof value.version !== "number" || typeof value.updatedAt !== "string" || !Array.isArray(value.offers)) {
    throw new Error("Scanned offer catalog must include version, updatedAt, and offers.");
  }

  for (const offer of value.offers) {
    assertScannedOffer(offer);
  }
}

function getBank(bankId: string, banksById: Map<string, Bank>): Bank {
  const bank = banksById.get(bankId);
  if (!bank) {
    throw new Error(`Scanned offer references missing bank: ${bankId}`);
  }
  return bank;
}

function getCard(cardId: string, cardsById: Map<string, Card>): Card {
  const card = cardsById.get(cardId);
  if (!card) {
    throw new Error(`Scanned offer references missing card: ${cardId}`);
  }
  return card;
}

function normalizeSourceUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return sourceUrl.replace(/#.*$/, "");
  }
}

export function loadScannedOfferCatalog(): ScannedOfferCatalog {
  const catalogJson = JSON.parse(readFileSync(join(process.cwd(), "data", "scanned-offers.json"), "utf8")) as unknown;

  assertScannedOfferCatalog(catalogJson);

  return catalogJson;
}

export function syncScannedOffers(seed: SeedData, catalog: ScannedOfferCatalog): SeedData {
  const banksById = new Map(seed.banks.map((bank) => [bank.id, bank]));
  const cardsById = new Map(seed.cards.map((card) => [card.id, card]));

  for (const scannedOffer of catalog.offers) {
    const bank = getBank(scannedOffer.bankId, banksById);
    const card = getCard(scannedOffer.cardId, cardsById);

    if (card.bankId !== bank.id) {
      throw new Error(`Scanned offer ${scannedOffer.id} has mismatched bank/card relationship.`);
    }
  }

  const scannedIds = new Set(catalog.offers.map((offer) => offer.id));
  const scannedSourceUrls = new Set(catalog.offers.map((offer) => normalizeSourceUrl(offer.sourceUrl)));
  const preservedOffers = seed.offers.filter(
    (offer) => !scannedIds.has(offer.id) && !scannedSourceUrls.has(normalizeSourceUrl(offer.sourceUrl))
  );
  const syncedOffers = catalog.offers.map(({ bankId: _bankId, ...offer }) => offer);

  return {
    ...seed,
    offers: [...preservedOffers, ...syncedOffers]
  };
}
