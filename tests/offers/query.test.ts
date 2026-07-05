import { describe, expect, it } from "vitest";
import {
  allQueryValues,
  buildFilterQueryString,
  isSortKey,
  parseOfferFilters,
  parseSortKey,
} from "@/lib/offers/query";

describe("allQueryValues", () => {
  it("wraps a single non-empty string into a one-element array", () => {
    expect(allQueryValues("ntb")).toEqual(["ntb"]);
  });

  it("drops empty and whitespace-only values from an array", () => {
    expect(allQueryValues(["ntb", " ", "", "ndb"])).toEqual(["ntb", "ndb"]);
  });

  it("returns an empty array when the value is undefined", () => {
    expect(allQueryValues(undefined)).toEqual([]);
  });
});

describe("parseOfferFilters", () => {
  it("parses repeated bank query params into bankIds", () => {
    expect(parseOfferFilters({ bank: ["ntb", "ndb"] })).toEqual({
      bankIds: ["ntb", "ndb"],
    });
  });

  it("parses repeated category query params into categories", () => {
    expect(parseOfferFilters({ category: ["dining", "fuel"] })).toEqual({
      categories: ["dining", "fuel"],
    });
  });

  it("drops invalid category values", () => {
    expect(parseOfferFilters({ category: ["dining", "not-a-real-category"] })).toEqual({
      categories: ["dining"],
    });
  });

  it("parses a legacy single bank value into a one-element bankIds array", () => {
    expect(parseOfferFilters({ bank: "ntb" })).toEqual({
      bankIds: ["ntb"],
    });
  });

  it("parses card and search into cardId and search", () => {
    expect(parseOfferFilters({ card: "visa-gold", search: "dining" })).toEqual({
      cardId: "visa-gold",
      search: "dining",
    });
  });

  it("returns an empty object when no params are given", () => {
    expect(parseOfferFilters({})).toEqual({});
  });
});

describe("isSortKey", () => {
  it("accepts known sort keys", () => {
    expect(isSortKey("expiring-soon")).toBe(true);
  });

  it("rejects unknown sort keys", () => {
    expect(isSortKey("bogus")).toBe(false);
  });
});

describe("parseSortKey", () => {
  it("reads a valid sort key from params", () => {
    expect(parseSortKey({ sort: "expiring-soon" })).toBe("expiring-soon");
  });

  it("falls back to relevance for an invalid sort key", () => {
    expect(parseSortKey({ sort: "bogus" })).toBe("relevance");
  });

  it("falls back to relevance when no sort param is given", () => {
    expect(parseSortKey({})).toBe("relevance");
  });
});

describe("buildFilterQueryString", () => {
  it("sets repeated bank keys from bankIds", () => {
    const result = buildFilterQueryString(new URLSearchParams(), { bankIds: ["ntb", "ndb"] });
    expect(new URLSearchParams(result).getAll("bank")).toEqual(["ntb", "ndb"]);
  });

  it("clears the bank key when bankIds is empty", () => {
    const result = buildFilterQueryString(new URLSearchParams("bank=ntb"), { bankIds: [] });
    expect(new URLSearchParams(result).getAll("bank")).toEqual([]);
  });

  it("leaves existing bank params untouched when bankIds is omitted", () => {
    const result = buildFilterQueryString(new URLSearchParams("bank=ntb"), { categories: ["dining"] });
    const next = new URLSearchParams(result);
    expect(next.getAll("bank")).toEqual(["ntb"]);
    expect(next.getAll("category")).toEqual(["dining"]);
  });

  it("omits sort from the result when set to the default sort", () => {
    const result = buildFilterQueryString(new URLSearchParams(), { sort: "relevance" });
    expect(new URLSearchParams(result).has("sort")).toBe(false);
  });

  it("includes sort in the result when set to a non-default sort", () => {
    const result = buildFilterQueryString(new URLSearchParams(), { sort: "newest" });
    expect(new URLSearchParams(result).get("sort")).toBe("newest");
  });
});
