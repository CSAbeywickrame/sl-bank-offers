import crypto from "node:crypto";
import { seedData } from "./seed";
import type { Bank, Card, CatalogOffer, Offer, SeedData } from "./types";

const banksById = new Map(seedData.banks.map((bank) => [bank.id, bank]));
const cardsById = new Map(seedData.cards.map((card) => [card.id, card]));

function toOfferStatus(status: CatalogOffer["status"]): Offer["status"] {
  return status;
}

function getCard(cardId: string): Card {
  const card = cardsById.get(cardId);
  if (!card) {
    throw new Error(`Seed card not found for offer relationship: ${cardId}`);
  }
  return card;
}

function getBank(bankId: string): Bank {
  const bank = banksById.get(bankId);
  if (!bank) {
    throw new Error(`Seed bank not found for card relationship: ${bankId}`);
  }
  return bank;
}

function toOffer(catalogOffer: CatalogOffer): Offer {
  const card = getCard(catalogOffer.cardId);
  const bank = getBank(card.bankId);
  const rawSourceHash = crypto.createHash("sha1").update(`${catalogOffer.id}|${catalogOffer.lastReviewedAt}`).digest("hex");

  return {
    id: catalogOffer.id,
    bankId: bank.id,
    bankName: bank.name,
    bankShortName: bank.shortName,
    cardId: card.id,
    cardName: card.name,
    title: catalogOffer.title,
    category: catalogOffer.category,
    description: catalogOffer.description,
    merchant: catalogOffer.merchant,
    location: catalogOffer.location,
    validFrom: catalogOffer.validFrom,
    validUntil: catalogOffer.validUntil,
    terms: catalogOffer.termsLink,
    sourceUrl: catalogOffer.sourceUrl,
    firstSeenAt: catalogOffer.lastReviewedAt,
    lastSeenAt: catalogOffer.lastReviewedAt,
    lastCheckedAt: catalogOffer.lastReviewedAt,
    status: toOfferStatus(catalogOffer.status),
    rawSourceHash
  };
}

export async function getSeedData(): Promise<SeedData> {
  return seedData;
}

export async function getAllOffers(): Promise<Offer[]> {
  return seedData.offers.map(toOffer);
}

export async function getActiveOffers(): Promise<Offer[]> {
  const offers = await getAllOffers();
  return offers.filter((offer) => offer.status === "active");
}

export async function getOfferById(offerId: string): Promise<Offer | undefined> {
  const offers = await getAllOffers();
  return offers.find((offer) => offer.id === offerId);
}
