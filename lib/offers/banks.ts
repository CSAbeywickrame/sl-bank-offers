import { seedData } from "./seed";
import type { Bank } from "./types";

export const banks: Bank[] = seedData.banks;

export function getBankById(bankId: string): Bank | undefined {
  return banks.find((bank) => bank.id === bankId);
}
