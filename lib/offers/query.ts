import { DEFAULT_PAGE_SIZE, firstQueryValue } from "./pagination";
import { isOfferCategory } from "./categories";
import { DEFAULT_SORT, sortKeys } from "./types";
import type { OfferFilters, SortKey } from "./types";

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
