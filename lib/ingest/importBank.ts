import type { ScannedOffer, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";
import { syncScannedOffers } from "@/lib/offers/scanned";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

// True if the offer has not expired as of reviewDateIso (no validUntil => always active).
export function isActiveOffer(validUntil: string | undefined, reviewDateIso: string): boolean {
  if (!validUntil) return true;
  const normalized = validUntil.includes("T") ? validUntil : `${validUntil}T23:59:59.999Z`;
  const expiry = new Date(normalized);
  if (!Number.isFinite(expiry.getTime())) return true;
  return expiry >= new Date(reviewDateIso);
}

// Replace ONE bank's offers as a batch. Returns updated { seed, catalog }.
export function importBankOffers(
  entry: BankRegistryEntry,
  offers: ScannedOffer[],
  reviewDateIso: string,
  seed: SeedData,
  catalog: ScannedOfferCatalog,
): { seed: SeedData; catalog: ScannedOfferCatalog } {
  const nextCatalog: ScannedOfferCatalog = {
    ...catalog,
    updatedAt: reviewDateIso,
    offers: [...catalog.offers.filter(o => o.bankId !== entry.bankId), ...offers],
  };
  const nextBanks = seed.banks.some(b => b.id === entry.bank.id)
    ? seed.banks
    : [...seed.banks, entry.bank];
  const existingCardIds = new Set(seed.cards.map(c => c.id));
  const nextCards = [...seed.cards, ...entry.cards.filter(c => !existingCardIds.has(c.id))];
  const cardIds = new Set(entry.cards.map(c => c.id));
  const seedWithoutBankOffers: SeedData = {
    ...seed,
    banks: nextBanks,
    cards: nextCards,
    offers: seed.offers.filter(o => !cardIds.has(o.cardId)),
  };
  return { seed: syncScannedOffers(seedWithoutBankOffers, nextCatalog), catalog: nextCatalog };
}

// Retire a bank: remove its offers from both catalog and seed, and remove its bank + cards metadata from seed.
export function removeBank(
  entry: BankRegistryEntry,
  reviewDateIso: string,
  seed: SeedData,
  catalog: ScannedOfferCatalog,
): { seed: SeedData; catalog: ScannedOfferCatalog } {
  const nextCatalog: ScannedOfferCatalog = {
    ...catalog,
    updatedAt: reviewDateIso,
    offers: catalog.offers.filter(o => o.bankId !== entry.bankId),
  };
  const cardIds = new Set(entry.cards.map(c => c.id));
  const nextSeedOffers = seed.offers.filter(o => !cardIds.has(o.cardId));
  const nextBanks = seed.banks.filter(b => b.id !== entry.bankId);
  const nextCards = seed.cards.filter(c => c.bankId !== entry.bankId);
  return {
    seed: { ...seed, banks: nextBanks, cards: nextCards, offers: nextSeedOffers },
    catalog: nextCatalog,
  };
}

// Drop every offer whose validUntil is past reviewDateIso, from BOTH seed.offers and catalog.offers.
export function expireLapsedOffers(
  reviewDateIso: string,
  seed: SeedData,
  catalog: ScannedOfferCatalog,
): { seed: SeedData; catalog: ScannedOfferCatalog; dropped: number } {
  const nextCatalogOffers = catalog.offers.filter(o => isActiveOffer(o.validUntil, reviewDateIso));
  const nextSeedOffers = seed.offers.filter(o => isActiveOffer(o.validUntil, reviewDateIso));
  const dropped =
    (catalog.offers.length - nextCatalogOffers.length) +
    (seed.offers.length - nextSeedOffers.length);
  return {
    seed: { ...seed, offers: nextSeedOffers },
    catalog: { ...catalog, offers: nextCatalogOffers },
    dropped,
  };
}

// Prune offers belonging to banks NOT in validBankIds.
export function reconcileOrphans(
  validBankIds: Set<string>,
  seed: SeedData,
  catalog: ScannedOfferCatalog,
): { seed: SeedData; catalog: ScannedOfferCatalog; dropped: number } {
  const cardToBankId = new Map<string, string>();
  for (const card of seed.cards) {
    cardToBankId.set(card.id, card.bankId);
  }
  const nextCatalogOffers = catalog.offers.filter(o => validBankIds.has(o.bankId));
  const nextSeedOffers = seed.offers.filter(o => {
    const bankId = cardToBankId.get(o.cardId);
    // Leave offers with an unknown cardId untouched; only prune offers we can attribute to a removed bank.
    return bankId === undefined || validBankIds.has(bankId);
  });
  const dropped =
    (catalog.offers.length - nextCatalogOffers.length) +
    (seed.offers.length - nextSeedOffers.length);
  // Also drop metadata for banks deleted outright from the registry, so bank/card rows don't leak.
  const nextSeedBanks = seed.banks.filter(b => validBankIds.has(b.id));
  const nextSeedCards = seed.cards.filter(c => validBankIds.has(c.bankId));
  return {
    seed: { ...seed, banks: nextSeedBanks, cards: nextSeedCards, offers: nextSeedOffers },
    catalog: { ...catalog, offers: nextCatalogOffers },
    dropped,
  };
}
