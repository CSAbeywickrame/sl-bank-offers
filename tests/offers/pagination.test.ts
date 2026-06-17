import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationParams,
  getVisiblePageNumbers,
  paginateItems,
} from "@/lib/offers/pagination";

describe("getPaginationParams", () => {
  it("falls back to page 1 and the default page size when params are missing", () => {
    expect(getPaginationParams({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("rejects unsupported or invalid query values", () => {
    expect(getPaginationParams({ page: "0", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    expect(getPaginationParams({ page: "not-a-number", pageSize: "abc" })).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("uses the first string value from repeated query params", () => {
    expect(getPaginationParams({ page: ["3", "4"], pageSize: ["24", "48"] })).toEqual({
      page: 3,
      pageSize: PAGE_SIZE_OPTIONS[1],
    });
  });
});

describe("paginateItems", () => {
  const items = Array.from({ length: 25 }, (_, index) => `offer-${index + 1}`);

  it("returns the expected slice and metadata for a valid page", () => {
    expect(paginateItems(items, { page: 2, pageSize: 12 })).toEqual({
      items: items.slice(12, 24),
      page: 2,
      pageSize: 12,
      totalItems: 25,
      totalPages: 3,
      startIndex: 13,
      endIndex: 24,
    });
  });

  it("clamps an out-of-range page to the last available page", () => {
    expect(paginateItems(items, { page: 99, pageSize: 12 })).toEqual({
      items: items.slice(24, 25),
      page: 3,
      pageSize: 12,
      totalItems: 25,
      totalPages: 3,
      startIndex: 25,
      endIndex: 25,
    });
  });

  it("keeps empty result sets on page 1 with a single empty page", () => {
    expect(paginateItems<string>([], { page: 4, pageSize: 24 })).toEqual({
      items: [],
      page: 1,
      pageSize: 24,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    });
  });
});

describe("getVisiblePageNumbers", () => {
  it("shows a compact window around the current page for long result sets", () => {
    expect(getVisiblePageNumbers(6, 20)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 20]);
  });

  it("expands to the leading edge when the current page is near the start", () => {
    expect(getVisiblePageNumbers(2, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
  });

  it("returns every page when the total is already small", () => {
    expect(getVisiblePageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
