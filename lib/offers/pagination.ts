const positiveIntegerPattern = /^[1-9]\d*$/;

export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

type PaginationQueryParams = Record<string, string | string[] | undefined>;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedItems<T> extends PaginationParams {
  items: T[];
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export type PageNumberToken = number | "ellipsis";

export function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePositiveInteger(value: string): number | undefined {
  if (!positiveIntegerPattern.test(value)) {
    return undefined;
  }

  return Number(value);
}

function isPageSizeOption(value: number): value is (typeof PAGE_SIZE_OPTIONS)[number] {
  return PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]);
}

export function getPaginationParams(params: PaginationQueryParams): PaginationParams {
  const rawPage = parsePositiveInteger(firstQueryValue(params.page));
  const rawPageSize = parsePositiveInteger(firstQueryValue(params.pageSize));

  return {
    page: rawPage ?? 1,
    pageSize: rawPageSize && isPageSizeOption(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE,
  };
}

export const parsePaginationParams = getPaginationParams;

export function paginateItems<T>(items: T[], state: PaginationParams): PaginatedItems<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  const page = totalItems === 0 ? 1 : Math.min(Math.max(state.page, 1), totalPages);
  const startOffset = (page - 1) * state.pageSize;
  const pagedItems = items.slice(startOffset, startOffset + state.pageSize);
  const startIndex = totalItems === 0 ? 0 : startOffset + 1;
  const endIndex = totalItems === 0 ? 0 : startOffset + pagedItems.length;

  return {
    items: pagedItems,
    page,
    pageSize: state.pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
  };
}

export function buildUpdatedQueryString(
  currentSearchParams: URLSearchParams,
  updates: Record<string, string | null | undefined>,
  options?: { resetPage?: boolean }
): string {
  const next = new URLSearchParams(currentSearchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    const normalized = value?.trim() ?? "";
    if (normalized) {
      next.set(key, normalized);
    } else {
      next.delete(key);
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

export function getVisiblePageNumbers(page: number, totalPages: number): PageNumberToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

export const getPaginationWindow = getVisiblePageNumbers;
