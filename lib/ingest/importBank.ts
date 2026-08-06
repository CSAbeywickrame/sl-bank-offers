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

interface RichnessCandidate {
  validUntil?: unknown;
  validFrom?: unknown;
  merchant?: unknown;
  location?: unknown;
  termsLink?: unknown;
  description?: unknown;
}

// Normalizes a merchant/description string for duplicate matching: lowercase, collapse
// non-alphanumeric runs to a single space, trim. Distinct from lib/ingest/textUtils.ts's
// normalizeText, which handles unicode/accent normalization — a different job.
function normalizeForDedupe(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Scores how "rich" a candidate record is: one point per populated optional field. Excludes
// `merchant` — it's part of the dedupe group key, so it's near-constant within a group and
// would add no signal.
function richnessScore(offer: RichnessCandidate): number {
  return [offer.validUntil, offer.validFrom, offer.location, offer.termsLink].filter(Boolean).length;
}

// Picks the richer of two same-offer candidates (plus a description-length tiebreak);
// the incumbent wins outright ties, giving a deterministic first-occurrence-wins result.
function richerOffer<T extends RichnessCandidate>(incumbent: T, candidate: T): T {
  const aDescription = typeof incumbent.description === "string" ? incumbent.description : "";
  const bDescription = typeof candidate.description === "string" ? candidate.description : "";
  const aScore = richnessScore(incumbent) + (aDescription.length > bDescription.length ? 1 : 0);
  const bScore = richnessScore(candidate) + (bDescription.length > aDescription.length ? 1 : 0);
  return bScore > aScore ? candidate : incumbent;
}

// Collapses duplicate offers. Runs two passes: exact id (the same offer re-imported), then
// semantic (same card + identity anchor + description reached via different source URLs, which
// mint different ids). The identity anchor is the merchant, falling back to the title when
// merchant is absent: distinct offers frequently share a generic boilerplate description (e.g.
// "25% OFF (Monday to Friday)") while the merchant name lives only in the title, so keying on
// description alone would collapse those distinct offers into one and delete real data.
export function dedupeOffers<
  T extends { id: string; cardId: string; merchant?: string; title?: string; description?: string } & RichnessCandidate
>(offers: T[]): T[] {
  // Pass 1: dedup by id, first occurrence wins.
  const byId = new Map<string, T>();
  for (const offer of offers) {
    if (!byId.has(offer.id)) byId.set(offer.id, offer);
  }

  // Pass 2: group survivors by cardId + normalized identity anchor (merchant, or title when
  // merchant is absent) + normalized description, keeping the richest record per group. A
  // group's output slot is the position of its first member.
  const result: T[] = [];
  const groupIndex = new Map<string, number>();
  for (const offer of byId.values()) {
    const normalizedAnchor = normalizeForDedupe(offer.merchant) || normalizeForDedupe(offer.title);
    const normalizedDescription = normalizeForDedupe(offer.description);
    if (!normalizedAnchor && !normalizedDescription) {
      // No merchant, no title, AND no description to compare — no evidence of sameness, don't guess.
      result.push(offer);
      continue;
    }
    const key = `${offer.cardId}|${normalizedAnchor}|${normalizedDescription}`;
    const existingIndex = groupIndex.get(key);
    if (existingIndex === undefined) {
      groupIndex.set(key, result.length);
      result.push(offer);
    } else {
      result[existingIndex] = richerOffer(result[existingIndex], offer);
    }
  }
  return result;
}
