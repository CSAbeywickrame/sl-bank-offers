import { DEFAULT_PAGE_SIZE, firstQueryValue } from "./pagination";
import { isOfferCategory } from "./categories";
import {
  addedWindows,
  cardKinds,
  cardNetworks,
  cardTierValues,
  DEFAULT_SORT,
  discountFloors,
  offerTypes,
  sortKeys,
  validityWindows,
  weekdays
} from "./types";
import type { AddedWindow, DiscountFloor, OfferFilters, SortKey, ValidityWindow, Weekday } from "./types";

// A URL is user input: anything not in the allowed set is dropped rather than trusted, so a
// hand-edited or stale link degrades to a broader result set instead of an error page.
function memberOf<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function membersOf<T extends string>(values: string[], allowed: readonly T[]): T[] | undefined {
  const kept = values.filter((value): value is T => allowed.includes(value as T));
  return kept.length > 0 ? kept : undefined;
}

// Normalizes a searchParams entry into a trimmed, non-empty string array
export function allQueryValues(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

// Checks whether a string is a valid offer list sort key
export function isSortKey(value: string): value is SortKey {
  return sortKeys.includes(value as SortKey);
}

// Builds offer filters (bankIds, categories, cardId, search) from raw searchParams
export function parseOfferFilters(params: Record<string, string | string[] | undefined>): OfferFilters {
  const filters: OfferFilters = {};

  const bankIds = allQueryValues(params.bank);
  if (bankIds.length > 0) {
    filters.bankIds = bankIds;
  }

  const categories = allQueryValues(params.category).filter(isOfferCategory);
  if (categories.length > 0) {
    filters.categories = categories;
  }

  const cardId = firstQueryValue(params.card).trim();
  if (cardId) {
    filters.cardId = cardId;
  }

  const search = firstQueryValue(params.search).trim();
  if (search) {
    filters.search = search;
  }

  const types = membersOf(allQueryValues(params.type), offerTypes);
  if (types) {
    filters.offerTypes = types;
  }

  // Only the advertised steps are honoured: `discount=17` is not a filter the UI can render back,
  // and silently accepting it would produce a state the chips and controls cannot represent.
  const discount = Number(firstQueryValue(params.discount));
  const floor = discountFloors.find((step) => step === discount) as DiscountFloor | undefined;
  if (floor !== undefined) {
    filters.minDiscountPct = floor;
  }

  const day = memberOf(firstQueryValue(params.day), weekdays) as Weekday | undefined;
  if (day) {
    filters.day = day;
  }

  const validity = memberOf(firstQueryValue(params.validity), validityWindows) as ValidityWindow | undefined;
  if (validity) {
    filters.validity = validity;
  }

  const added = memberOf(firstQueryValue(params.added), addedWindows) as AddedWindow | undefined;
  if (added) {
    filters.added = added;
  }

  const networks = membersOf(allQueryValues(params.network), cardNetworks);
  if (networks) {
    filters.cardNetworks = networks;
  }

  const kinds = membersOf(allQueryValues(params.cardtype), cardKinds);
  if (kinds) {
    filters.cardTypes = kinds;
  }

  const tiers = membersOf(allQueryValues(params.tier), cardTierValues);
  if (tiers) {
    filters.cardTiers = tiers;
  }

  return filters;
}

// Reads the sort query param, falling back to the default sort when missing or invalid
export function parseSortKey(params: Record<string, string | string[] | undefined>): SortKey {
  const sort = firstQueryValue(params.sort);
  return isSortKey(sort) ? sort : DEFAULT_SORT;
}

// Builds an updated query string for filter/sort changes, supporting repeated keys for array params
export function buildFilterQueryString(
  current: URLSearchParams,
  updates: {
    bankIds?: string[];
    categories?: string[];
    cardId?: string;
    search?: string;
    sort?: SortKey;
    offerTypes?: string[];
    minDiscountPct?: number;
    day?: string;
    validity?: string;
    added?: string;
    cardNetworks?: string[];
    cardTypes?: string[];
    cardTiers?: string[];
  },
  options?: { resetPage?: boolean }
): string {
  const next = new URLSearchParams(current.toString());

  if (updates.bankIds !== undefined) {
    next.delete("bank");
    for (const bankId of updates.bankIds) {
      const normalized = bankId.trim();
      if (normalized) {
        next.append("bank", normalized);
      }
    }
  }

  if (updates.categories !== undefined) {
    next.delete("category");
    for (const category of updates.categories) {
      const normalized = category.trim();
      if (normalized) {
        next.append("category", normalized);
      }
    }
  }

  if (updates.cardId !== undefined) {
    const normalized = updates.cardId.trim();
    if (normalized) {
      next.set("card", normalized);
    } else {
      next.delete("card");
    }
  }

  if (updates.search !== undefined) {
    const normalized = updates.search.trim();
    if (normalized) {
      next.set("search", normalized);
    } else {
      next.delete("search");
    }
  }

  setMulti(next, "type", updates.offerTypes);
  setMulti(next, "network", updates.cardNetworks);
  setMulti(next, "cardtype", updates.cardTypes);
  setMulti(next, "tier", updates.cardTiers);
  // Key presence, not value: `{ minDiscountPct: undefined }` is how the UI says "clear this", while
  // an absent key means "leave it alone". Reading the value alone conflates the two, and the filter
  // then survives every attempt to remove it.
  if ("minDiscountPct" in updates) {
    setSingle(next, "discount", updates.minDiscountPct === undefined ? "" : String(updates.minDiscountPct));
  }
  setSingle(next, "day", updates.day);
  setSingle(next, "validity", updates.validity);
  setSingle(next, "added", updates.added);

  if (updates.sort !== undefined) {
    if (updates.sort === DEFAULT_SORT) {
      next.delete("sort");
    } else {
      next.set("sort", updates.sort);
    }
  }

  if (options?.resetPage || next.get("page") === "1") {
    next.delete("page");
  }

  if (next.get("pageSize") === String(DEFAULT_PAGE_SIZE)) {
    next.delete("pageSize");
  }

  return next.toString();
}

// Replaces every value for a repeated key, dropping the key entirely when the selection is empty so
// a cleared filter leaves no trace in the URL.
function setMulti(params: URLSearchParams, key: string, values: string[] | undefined): void {
  if (values === undefined) return;
  params.delete(key);
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) params.append(key, normalized);
  }
}

// Same, for keys that hold a single value. An empty string clears rather than storing a blank.
function setSingle(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value === undefined) return;
  const normalized = value.trim();
  if (normalized) params.set(key, normalized);
  else params.delete(key);
}
