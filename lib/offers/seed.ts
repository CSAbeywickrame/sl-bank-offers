import { readFileSync } from "node:fs";
import { join } from "node:path";
import { offerCategories, type SeedData } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertSeedData(value: unknown): asserts value is SeedData {
  if (!isRecord(value)) {
    throw new Error("Seed data must be an object.");
  }

  if (!Array.isArray(value.banks) || !Array.isArray(value.cards) || !Array.isArray(value.offers)) {
    throw new Error("Seed data must include banks, cards, and offers arrays.");
  }

  for (const bank of value.banks) {
    if (!isRecord(bank) || typeof bank.id !== "string" || typeof bank.name !== "string" || typeof bank.shortName !== "string" || typeof bank.websiteUrl !== "string") {
      throw new Error("Seed bank entries must include id, name, shortName, and websiteUrl.");
    }
  }

  for (const card of value.cards) {
    if (!isRecord(card) || typeof card.id !== "string" || typeof card.bankId !== "string" || typeof card.name !== "string") {
      throw new Error("Seed card entries must include id, bankId, and name.");
    }
  }

  for (const offer of value.offers) {
    if (
      !isRecord(offer) ||
      typeof offer.id !== "string" ||
      typeof offer.cardId !== "string" ||
      typeof offer.title !== "string" ||
      typeof offer.category !== "string" ||
      !offerCategories.includes(offer.category as (typeof offerCategories)[number]) ||
      typeof offer.description !== "string" ||
      typeof offer.termsLink !== "string" ||
      typeof offer.sourceUrl !== "string" ||
      typeof offer.lastReviewedAt !== "string" ||
      typeof offer.status !== "string"
    ) {
      throw new Error("Seed offer entries must include valid card, category, terms, source, and review metadata.");
    }
  }
}

export function loadSeedData(): SeedData {
  const seedDataJson = JSON.parse(readFileSync(join(process.cwd(), "data", "seed.json"), "utf8")) as unknown;

  assertSeedData(seedDataJson);

  return seedDataJson;
}
