import { seedData } from "./seed";
import type { Card } from "./types";

export const cards: Card[] = seedData.cards;

export function getCardsByBankId(bankId?: string): Card[] {
  if (!bankId) {
    return cards;
  }

  return cards.filter((card) => card.bankId === bankId);
}
