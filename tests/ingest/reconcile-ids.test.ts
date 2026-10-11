import { describe, expect, it } from "vitest";
import { reconcileOfferIds } from "@/lib/ingest/reconcileIds";
import type { ScannedOffer } from "@/lib/offers/types";

const NOW = "2026-06-19T00:00:00.000Z";
const URL_A = "https://bank.lk/promotion/a/";
const URL_B = "https://bank.lk/promotion/b/";

function offer(id: string, sourceUrl: string, merchant?: string, validUntil?: string): ScannedOffer {
  return {
    id, bankId: "bank", cardId: "bank-cards", title: `title-${id}`, category: "dining", description: "d",
    termsLink: sourceUrl, sourceUrl, lastReviewedAt: "2026-06-10T00:00:00.000Z", status: "active",
    ...(merchant ? { merchant } : {}),
    ...(validUntil ? { validUntil } : {}),
  };
}

const ids = (offers: ScannedOffer[]) => offers.map((o) => o.id);

describe("reconcileOfferIds", () => {
  it("keeps ids that already match a prior offer", () => {
    expect(ids(reconcileOfferIds([offer("old", URL_A)], [offer("old", URL_A)], NOW))).toEqual(["old"]);
  });

  it("reuses the prior id when it is the only offer at the url on both sides", () => {
    expect(ids(reconcileOfferIds([offer("new", URL_A)], [offer("old", URL_A)], NOW))).toEqual(["old"]);
  });

  it("matches the url ignoring fragments and trailing-slash differences", () => {
    expect(ids(reconcileOfferIds([offer("new", "https://bank.lk/promotion/a#x")], [offer("old", URL_A)], NOW))).toEqual(["old"]);
  });

  it("does not match across different urls", () => {
    expect(ids(reconcileOfferIds([offer("new", URL_B)], [offer("old", URL_A)], NOW))).toEqual(["new"]);
  });

  it("matches by merchant when a url holds several offers", () => {
    const prior = [offer("p1", URL_A, "Keells"), offer("p2", URL_A, "Cargills")];
    const next = [offer("n1", URL_A, "KEELLS"), offer("n2", URL_A, "Cargills")];
    expect(ids(reconcileOfferIds(next, prior, NOW))).toEqual(["p1", "p2"]);
  });

  it("leaves ambiguous merchants unmatched", () => {
    const prior = [offer("p1", URL_A, "Keells"), offer("p2", URL_A, "Keells")];
    const next = [offer("n1", URL_A, "Keells"), offer("n2", URL_A, "Keells")];
    expect(ids(reconcileOfferIds(next, prior, NOW))).toEqual(["n1", "n2"]);
  });

  it("leaves offers without a merchant unmatched when the url is shared", () => {
    const prior = [offer("p1", URL_A), offer("p2", URL_A)];
    expect(ids(reconcileOfferIds([offer("n1", URL_A), offer("n2", URL_A)], prior, NOW))).toEqual(["n1", "n2"]);
  });

  it("never gives one prior id to two new offers", () => {
    const prior = [offer("p1", URL_A, "Keells")];
    const next = [offer("n1", URL_A, "Keells"), offer("n2", URL_A, "Keells")];
    expect(new Set(ids(reconcileOfferIds(next, prior, NOW))).size).toBe(2);
  });

  it("does not steal a prior id that an exact-id match keeps", () => {
    const prior = [offer("p1", URL_A, "Keells"), offer("p2", URL_A, "Cargills")];
    const next = [offer("p1", URL_A, "Keells"), offer("n2", URL_A, "Cargills")];
    expect(ids(reconcileOfferIds(next, prior, NOW))).toEqual(["p1", "p2"]);
  });

  it("does not reuse the id when the url went from one offer to several", () => {
    const next = [offer("n1", URL_A), offer("n2", URL_A)];
    expect(ids(reconcileOfferIds(next, [offer("p1", URL_A)], NOW))).toEqual(["n1", "n2"]);
  });

  it("does not match a single offer to a prior with a different merchant", () => {
    expect(ids(reconcileOfferIds([offer("n1", URL_A, "Keells")], [offer("p1", URL_A, "Cargills")], NOW))).toEqual(["n1"]);
  });

  it("still matches a single offer when one side has no merchant", () => {
    expect(ids(reconcileOfferIds([offer("n1", URL_A, "Keells")], [offer("p1", URL_A)], NOW))).toEqual(["p1"]);
  });

  it("never groups offers with an empty or unparseable sourceUrl", () => {
    expect(ids(reconcileOfferIds([offer("n1", "")], [offer("p1", "")], NOW))).toEqual(["n1"]);
    expect(ids(reconcileOfferIds([offer("n1", "not a url")], [offer("p1", "not a url")], NOW))).toEqual(["n1"]);
  });

  it("never reuses the id of an expired prior offer", () => {
    expect(ids(reconcileOfferIds([offer("n1", URL_A)], [offer("p1", URL_A, undefined, "2026-01-01")], NOW))).toEqual(["n1"]);
  });
});
