import { describe, expect, it } from "vitest";
import { parseMaxDetails, resolveRunConfig, type BankKind } from "@/lib/ingest/forceExtract";

const banks: { bankId: string; kind: BankKind }[] = [
  { bankId: "sampath", kind: "feed" },
  { bankId: "peoples-bank", kind: "crawl" },
  { bankId: "dfcc", kind: "claude" },
];

describe("parseMaxDetails", () => {
  it("treats unset and blank as no cap", () => {
    expect(parseMaxDetails(undefined)).toEqual({ ok: true, value: Infinity });
    expect(parseMaxDetails("  ")).toEqual({ ok: true, value: Infinity });
  });

  it("accepts a trimmed positive integer", () => {
    expect(parseMaxDetails(" 25 ")).toEqual({ ok: true, value: 25 });
  });

  it("rejects anything else", () => {
    for (const v of ["0", "-3", "1.5", "abc", "10x", "1e3"]) {
      expect(parseMaxDetails(v).ok).toBe(false);
    }
  });
});

describe("resolveRunConfig", () => {
  it("is on when forced with scoped, known banks", () => {
    expect(resolveRunConfig("1", "", new Set(["sampath"]), banks)).toEqual({ ok: true, force: true, maxDetails: Infinity });
  });

  it("errors when forced without ONLY_BANKS", () => {
    expect(resolveRunConfig("1", "", new Set(), banks).ok).toBe(false);
  });

  it("errors on unknown bank ids when forced, listing them", () => {
    const result = resolveRunConfig("1", "", new Set(["sampath", "nope", "nada"]), banks);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("nope, nada");
  });

  it("is off when unset, and off for values other than 1 even without banks", () => {
    expect(resolveRunConfig(undefined, "", new Set(["sampath"]), banks)).toMatchObject({ ok: true, force: false });
    for (const v of ["", "true", "0", "yes", " 1"]) {
      expect(resolveRunConfig(v, "", new Set(), banks)).toMatchObject({ ok: true, force: false });
    }
  });

  it("does not check bank ids when not forcing", () => {
    expect(resolveRunConfig(undefined, "", new Set(["nope"]), banks)).toMatchObject({ ok: true, force: false });
  });

  it("rejects an invalid cap with or without force", () => {
    expect(resolveRunConfig(undefined, "abc", new Set(), banks).ok).toBe(false);
    expect(resolveRunConfig("1", "0", new Set(["sampath"]), banks).ok).toBe(false);
  });

  it("returns the parsed cap", () => {
    expect(resolveRunConfig("1", "10", new Set(["peoples-bank"]), banks)).toEqual({ ok: true, force: true, maxDetails: 10 });
    expect(resolveRunConfig(undefined, "10", new Set(), banks)).toMatchObject({ maxDetails: 10 });
  });

  it("refuses a capped forced run on a non-crawl Claude bank", () => {
    expect(resolveRunConfig("1", "10", new Set(["dfcc"]), banks).ok).toBe(false);
    expect(resolveRunConfig("1", "", new Set(["dfcc"]), banks).ok).toBe(true);
    expect(resolveRunConfig("1", "10", new Set(["sampath"]), banks).ok).toBe(true);
  });
});
