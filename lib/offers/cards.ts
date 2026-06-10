import { loadSeedData } from "./seed";
import type { Card } from "./types";

export function getCards(): Card[] {
  return loadSeedData().cards;
}

export function getCardsByBankId(bankId?: string): Card[] {
  const cards = getCards();

  if (!bankId) {
    return cards;
  }

  return cards.filter((card) => card.bankId === bankId);
}
