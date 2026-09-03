import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Offer } from "@/lib/offers/types";

const activeOffers = vi.hoisted(() => ({ current: [] as Offer[] }));
vi.mock("@/lib/offers/repository", () => ({
  getActiveOffers: async () => activeOffers.current
}));

import {
  getCanonicalMerchantSlug,
  getGroupSiblings,
  getMerchantBySlug,
  getMerchantOffers,
  getMerchantSummaries,
  getMultiBankMerchants,
  getRelatedOffers,
  merchantSlug,
  resetMerchantIndexForTests,
  resolveMerchant
} from "@/lib/offers/merchants";

const offer = (overrides: Partial<Offer>): Offer =>
  ({
    id: "id",
    bankId: "hnb",
    bankName: "HNB",
    title: "Offer",
    category: "hotels",
    description: "",
    sourceUrl: "https://example.lk",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    lastCheckedAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    rawSourceHash: "hash",
    ...overrides
  }) as Offer;

beforeEach(() => {
  activeOffers.current = [];
  resetMerchantIndexForTests();
});

describe("merchantSlug", () => {
  it("folds case, punctuation and accents", () => {
    expect(merchantSlug("Keells Super")).toBe("keells-super");
    expect(merchantSlug("findmyfare.com")).toBe("findmyfare-com");
    expect(merchantSlug("Oak Ray Heritage, Kandy")).toBe("oak-ray-heritage-kandy");
    expect(merchantSlug("Café Français")).toBe("cafe-francais");
  });

  it("drops trailing legal suffixes, which carry no identity", () => {
    expect(merchantSlug("SLEEP MAKERS (PVT) LTD")).toBe("sleep-makers");
    expect(merchantSlug("Toyotsu Lanka (Private) Limited")).toBe("toyotsu-lanka");
    expect(merchantSlug("Abans PLC")).toBe("abans");
  });

  it("keeps a suffix word that is part of the name itself", () => {
    expect(merchantSlug("Limited Edition Store")).toBe("limited-edition-store");
  });

  it("expands & so one spelling of a name does not split from the other", () => {
    expect(merchantSlug("Cinnamon Hotels & Resorts")).toBe(merchantSlug("Cinnamon Hotels and Resorts"));
  });

  // The whole safety property of this module. A restaurant inside a hotel is somewhere else to
  // spend money, and merging it would apply a dining discount to a room booking.
  it("never merges an outlet into the property that houses it", () => {
    expect(merchantSlug("Jetwing Beach")).not.toBe(merchantSlug("Jetwing Beach - The Deck"));
    expect(merchantSlug("Jetwing Yala")).not.toBe(merchantSlug("Jetwing Jaffna"));
  });
});

describe("resolveMerchant", () => {
  it("routes a curated spelling variant to the canonical merchant", () => {
    expect(resolveMerchant("Anantaya Resort and Spa Passikuda")?.slug).toBe("anantaya-resort-and-spa-pasikuda");
    expect(resolveMerchant("Anantaya Resort and Spa Pasikudah")?.slug).toBe("anantaya-resort-and-spa-pasikuda");
  });

  it("inherits the group from whatever the alias points at", () => {
    expect(resolveMerchant("Anantaya Resort and Spa Passikuda")?.group).toBe("Anantaya");
  });

  it("leaves an unlisted merchant on its own slug", () => {
    expect(resolveMerchant("Some New Cafe")).toEqual({ slug: "some-new-cafe" });
  });

  it("returns undefined for a name that slugs to nothing", () => {
    expect(resolveMerchant("   ")).toBeUndefined();
    expect(resolveMerchant("!!!")).toBeUndefined();
  });
});

describe("merchant index", () => {
  it("counts offers and distinct banks, and reports the best advertised discount", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Keells", bankName: "HNB", discountPct: 10 }),
      offer({ id: "b", merchant: "Keells", bankName: "ComBank", discountPct: 25 }),
      offer({ id: "c", merchant: "Keells", bankName: "ComBank" })
    ];
    const keells = await getMerchantBySlug("keells");
    expect(keells).toMatchObject({ offerCount: 3, bankCount: 2, bestDiscountPct: 25 });
    expect(keells?.banks).toEqual(["ComBank", "HNB"]);
  });

  it("omits the best discount when no offer states one", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Keells" })];
    expect(await getMerchantBySlug("keells")).not.toHaveProperty("bestDiscountPct");
  });

  it("displays the fullest spelling seen", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Laya Beach" }),
      offer({ id: "b", merchant: "Laya Beach Wadduwa" })
    ];
    expect((await getMerchantBySlug("laya-beach-wadduwa"))?.name).toBe("Laya Beach Wadduwa");
  });

  it("ranks merchants worth comparing across cards first", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Solo Shop", bankName: "HNB" }),
      offer({ id: "b", merchant: "Solo Shop", bankName: "HNB" }),
      offer({ id: "c", merchant: "Everywhere", bankName: "HNB" }),
      offer({ id: "d", merchant: "Everywhere", bankName: "ComBank" })
    ];
    expect((await getMerchantSummaries())[0].slug).toBe("everywhere");
  });

  it("lists only merchants that deal with more than one bank", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Solo Shop", bankName: "HNB" }),
      offer({ id: "b", merchant: "Everywhere", bankName: "HNB" }),
      offer({ id: "c", merchant: "Everywhere", bankName: "ComBank" })
    ];
    expect((await getMultiBankMerchants()).map((m) => m.slug)).toEqual(["everywhere"]);
  });

  it("skips offers with no merchant rather than inventing one", async () => {
    activeOffers.current = [offer({ id: "a" }), offer({ id: "b", merchant: "  " })];
    expect(await getMerchantSummaries()).toEqual([]);
  });
});

describe("getRelatedOffers", () => {
  it("returns the merchant's other offers, best discount first", async () => {
    activeOffers.current = [
      offer({ id: "viewed", merchant: "Keells", bankName: "HNB", discountPct: 10 }),
      offer({ id: "better", merchant: "Keells", bankName: "ComBank", discountPct: 25 }),
      offer({ id: "plain", merchant: "Keells", bankName: "NDB" })
    ];
    expect((await getRelatedOffers("keells", "viewed")).map((o) => o.id)).toEqual(["better", "plain"]);
  });

  it("returns nothing when the merchant only has the offer being viewed", async () => {
    activeOffers.current = [offer({ id: "only", merchant: "Keells" })];
    expect(await getRelatedOffers("keells", "only")).toEqual([]);
  });
});

describe("getGroupSiblings", () => {
  // Same brand, still separate merchants — a strip to explore, not a claim that the offers apply
  // at each other's properties.
  it("lists other merchants in the same curated brand", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Jetwing Beach" }),
      offer({ id: "b", merchant: "Jetwing Yala" }),
      offer({ id: "c", merchant: "Keells" })
    ];
    expect((await getGroupSiblings("jetwing-beach")).map((m) => m.slug)).toEqual(["jetwing-yala"]);
  });

  it("returns nothing for a merchant in no group", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Keells" })];
    expect(await getGroupSiblings("keells")).toEqual([]);
  });

  it("does not treat a group as a merger — each property keeps its own counts", async () => {
    activeOffers.current = [
      offer({ id: "a", merchant: "Jetwing Beach", bankName: "HNB" }),
      offer({ id: "b", merchant: "Jetwing Yala", bankName: "ComBank" })
    ];
    expect((await getMerchantBySlug("jetwing-beach"))?.offerCount).toBe(1);
    expect((await getMerchantBySlug("jetwing-yala"))?.offerCount).toBe(1);
  });
});

describe("getMerchantOffers", () => {
  it("returns an empty list for an unknown merchant rather than throwing", async () => {
    expect(await getMerchantOffers("nope")).toEqual([]);
  });
});

/**
 * The alias redirect shipped broken once: a bad edit produced `/merchants/` with no slug, and
 * because it is a PERMANENT redirect, browsers and crawlers cache the dead URL. These pin the
 * target itself rather than the fact that some redirect happens.
 */
describe("getCanonicalMerchantSlug", () => {
  it("names the canonical merchant an alias should land on", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Anantaya Resort and Spa Pasikuda" })];
    expect(await getCanonicalMerchantSlug("anantaya-resort-and-spa-passikuda")).toBe(
      "anantaya-resort-and-spa-pasikuda"
    );
  });

  it("returns nothing for a merchant that already exists, so the page renders instead", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Keells" })];
    expect(await getCanonicalMerchantSlug("keells")).toBeUndefined();
  });

  it("returns nothing for a slug that resolves nowhere, so the page 404s", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Keells" })];
    expect(await getCanonicalMerchantSlug("does-not-exist")).toBeUndefined();
  });

  // An alias pointing at a merchant with no live offers must not redirect into a 404.
  it("returns nothing when the canonical merchant has no offers", async () => {
    activeOffers.current = [offer({ id: "a", merchant: "Keells" })];
    expect(await getCanonicalMerchantSlug("anantaya-resort-and-spa-passikuda")).toBeUndefined();
  });
});
