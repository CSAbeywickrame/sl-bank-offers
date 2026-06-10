import { loadSeedData } from "./seed";
import type { Bank } from "./types";

export function getBanks(): Bank[] {
  return loadSeedData().banks;
}

export function getBankById(bankId: string): Bank | undefined {
  return getBanks().find((bank) => bank.id === bankId);
}
