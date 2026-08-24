import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getActiveOffers } from "./repository";
import type { Offer } from "./types";

/**
 * Merchant identity for the catalog.
 *
 * Banks write merchant names freehand, so one place appears under several spellings while several
 * places share a prefix. The two mistakes available here are opposite and both bad: merge too
 * eagerly and a restaurant's discount starts claiming to cover a room booking; merge too little
 * and the cross-bank comparison that makes a merchant page worth visiting never forms.
 *
 * The rule this module follows is that identity is decided by what a cardholder can actually spend
 * at, so it stays at OUTLET level:
 *
 *   "Jetwing Beach"                  — the hotel
 *   "Jetwing Beach - The Deck"       — a restaurant inside it, a DIFFERENT merchant
 *   "Jetwing Yala"                   — a different hotel in the same chain
 *   "Jetwing Hotels"                 — the chain itself
 *
 * Nothing is ever merged automatically. Names collapse only through the curated table in
 * data/merchant-aliases.json, which exists to fix spellings of ONE place ("Jetwing Waha Waluwa" ->
 * "Jetwing Wahawa Walauwa"), never to fold siblings together. `group` is the softer relationship:
 * it powers a "more from this brand" strip without claiming the offers are interchangeable.
 */

export interface MerchantSummary {
  slug: string;
  /** The most complete spelling seen, used as the display name. */
  name: string;
  offerCount: number;
  bankCount: number;
  /** Highest advertised discount across the merchant's live offers, when any states one. */
  bestDiscountPct?: number;
  /** Bank display names, alphabetical. */
  banks: string[];
  /** Curated brand this merchant belongs to, when it is part of one. */
  group?: string;
}

interface AliasEntry {
  canonical?: string;
  group?: string;
}

// Legal and trading suffixes carry no identity — "Abans PLC" and "Abans" are one shop. Stripped
// from the tail only, so a name that merely contains the word survives intact.
const LEGAL_SUFFIX =
  /\s*[,\-–]?\s*\(?\b(?:pvt|private)\b\)?\.?\s*\b(?:ltd|limited)\b\.?$|\s*\b(?:plc|ltd|limited|inc|llc)\b\.?$/i;

/**
 * Stable url-safe key for a merchant name.
 *
 * Deliberately conservative: it folds case, accents, punctuation and legal suffixes, and nothing
 * else. It will never decide that two differently-worded names are the same place — that judgement
 * belongs in the alias table, where a human made it.
 */
export function merchantSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(LEGAL_SUFFIX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let aliasCache: Record<string, AliasEntry> | undefined;

function loadAliases(): Record<string, AliasEntry> {
  if (aliasCache) return aliasCache;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "merchant-aliases.json"), "utf8");
    aliasCache = parseAliasMap(JSON.parse(raw) as unknown);
  } catch {
    // A missing or malformed alias file degrades to no aliasing rather than taking the site down:
    // every merchant simply stands on its own slug, which is the pre-alias behaviour.
    aliasCache = {};
  }
  return aliasCache;
}

// Keys starting with "_" are documentation for whoever edits the file next, not merchants.
function isAliasEntry(entry: unknown): entry is AliasEntry {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
  return ["canonical", "group"].every((key) => {
    const field = (entry as Record<string, unknown>)[key];
    return field === undefined || typeof field === "string";
  });
}

function parseAliasMap(value: unknown): Record<string, AliasEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const entries: Record<string, AliasEntry> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith("_")) continue;
    // One malformed entry is skipped rather than discarding the whole curated table.
    if (isAliasEntry(entry)) entries[key] = entry;
  }
  return entries;
}

export interface ResolvedMerchant {
  slug: string;
  group?: string;
}

/** Resolves a raw merchant name to the slug it should be counted under. */
export function resolveMerchant(name: string): ResolvedMerchant | undefined {
  const slug = merchantSlug(name);
  if (!slug) return undefined;
  const aliases = loadAliases();
  const entry = aliases[slug];
  const canonical = entry?.canonical ? merchantSlug(entry.canonical) : slug;
  // The group can be declared on the alias itself or inherited from whatever it points at, so a
  // brand only has to be named once per family.
  const group = entry?.group ?? aliases[canonical]?.group;
  return { slug: canonical || slug, ...(group ? { group } : {}) };
}

interface MerchantIndex {
  summaries: MerchantSummary[];
  bySlug: Map<string, MerchantSummary>;
  offersBySlug: Map<string, Offer[]>;
}

let indexPromise: Promise<MerchantIndex> | undefined;

async function buildIndex(): Promise<MerchantIndex> {
  const offers = await getActiveOffers();
  const offersBySlug = new Map<string, Offer[]>();
  const groupBySlug = new Map<string, string>();
  // Longest spelling wins as the display name: banks abbreviate inconsistently, and the fuller
  // string is the one that tells a reader which branch or property they are looking at.
  const nameBySlug = new Map<string, string>();

  for (const offer of offers) {
    if (!offer.merchant?.trim()) continue;
    const resolved = resolveMerchant(offer.merchant);
    if (!resolved) continue;
    const { slug, group } = resolved;

    const bucket = offersBySlug.get(slug);
    if (bucket) bucket.push(offer);
    else offersBySlug.set(slug, [offer]);

    if (group) groupBySlug.set(slug, group);
    const name = offer.merchant.trim();
    const current = nameBySlug.get(slug);
    if (!current || name.length > current.length) nameBySlug.set(slug, name);
  }

  const summaries: MerchantSummary[] = [];
  for (const [slug, merchantOffers] of offersBySlug) {
    const banks = [...new Set(merchantOffers.map((offer) => offer.bankName))].sort();
    const discounts = merchantOffers
      .map((offer) => offer.discountPct)
      .filter((pct): pct is number => typeof pct === "number");
    const group = groupBySlug.get(slug);
    summaries.push({
      slug,
      name: nameBySlug.get(slug) ?? slug,
      offerCount: merchantOffers.length,
      bankCount: banks.length,
      ...(discounts.length > 0 ? { bestDiscountPct: Math.max(...discounts) } : {}),
      banks,
      ...(group ? { group } : {})
    });
  }

  // Most banks first, then most offers, then alphabetical — the merchants worth comparing across
  // cards rise to the top, which is the whole reason someone opens a merchant list.
  summaries.sort(
    (a, b) =>
      b.bankCount - a.bankCount ||
      b.offerCount - a.offerCount ||
      a.name.localeCompare(b.name)
  );

  return { summaries, bySlug: new Map(summaries.map((s) => [s.slug, s])), offersBySlug };
}

// Memoized: the catalog is read from disk at build time and never changes within a render pass, so
// every page can ask for the index without rebuilding it. A failure is not memoized — caching the
// rejected promise would turn one bad read into a permanently broken index for the whole process.
function getIndex(): Promise<MerchantIndex> {
  indexPromise ??= buildIndex().catch((error: unknown) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

export async function getMerchantSummaries(): Promise<MerchantSummary[]> {
  return (await getIndex()).summaries;
}

/** Merchants with offers at more than one bank — the ones where comparing cards actually pays. */
export async function getMultiBankMerchants(): Promise<MerchantSummary[]> {
  return (await getMerchantSummaries()).filter((merchant) => merchant.bankCount > 1);
}

export async function getMerchantBySlug(slug: string): Promise<MerchantSummary | undefined> {
  return (await getIndex()).bySlug.get(slug);
}

/** Every live offer for a merchant, best-advertised-discount first. */
export async function getMerchantOffers(slug: string): Promise<Offer[]> {
  const offers = (await getIndex()).offersBySlug.get(slug) ?? [];
  return [...offers].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1));
}

/**
 * The same merchant's offers at OTHER banks — the "you could do better with a different card"
 * comparison. Excludes the offer being viewed, and returns nothing when the merchant only deals
 * with one bank, since a comparison of one is not a comparison.
 */
export async function getRelatedOffers(slug: string, excludeOfferId?: string): Promise<Offer[]> {
  const offers = await getMerchantOffers(slug);
  return offers.filter((offer) => offer.id !== excludeOfferId);
}

/** Other merchants under the same curated brand, for a "more from this group" strip. */
export async function getGroupSiblings(slug: string): Promise<MerchantSummary[]> {
  const index = await getIndex();
  const merchant = index.bySlug.get(slug);
  if (!merchant?.group) return [];
  return index.summaries.filter((other) => other.group === merchant.group && other.slug !== slug);
}

/** Test seam: clears the memoized index and alias file so a case can supply its own fixtures. */
export function resetMerchantIndexForTests(): void {
  indexPromise = undefined;
  aliasCache = undefined;
}
