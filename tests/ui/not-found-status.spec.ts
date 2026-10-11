import { expect, test } from "@playwright/test";
import { getMerchantSummaries } from "@/lib/offers/merchants";
import { getActiveOffers } from "@/lib/offers/repository";

interface RouteCase {
  name: string;
  bogus: string;
  getRealPath: () => Promise<string>;
}

// Picks the first currently active offer so the real-URL cases never expire
const getFirstActiveOffer = async () => {
  const [offer] = await getActiveOffers();
  return offer;
};

// One bogus URL and one real URL (derived from live data) per dynamic route
const routes: RouteCase[] = [
  {
    name: "offers",
    bogus: "/offers/zzz-bogus",
    getRealPath: async () => `/offers/${(await getFirstActiveOffer()).id}`
  },
  {
    name: "banks",
    bogus: "/banks/zzz-bogus",
    getRealPath: async () => `/banks/${(await getFirstActiveOffer()).bankId}`
  },
  {
    name: "categories",
    bogus: "/categories/zzz-bogus",
    getRealPath: async () => `/categories/${(await getFirstActiveOffer()).category}`
  },
  {
    name: "merchants",
    bogus: "/merchants/zzz-bogus",
    getRealPath: async () => `/merchants/${(await getMerchantSummaries())[0].slug}`
  }
];

// Guards the (home) route-group move
test("home page returns 200", async ({ request }) => {
  expect((await request.get("/")).status()).toBe(200);
});

for (const route of routes) {
  test.describe(`${route.name} status codes`, () => {
    // Unknown ids must be a real 404, not a streamed 200 soft-404
    test("unknown id returns 404", async ({ request }) => {
      expect((await request.get(route.bogus)).status()).toBe(404);
    });

    // Known ids must still render normally
    test("known id returns 200", async ({ request }) => {
      expect((await request.get(await route.getRealPath())).status()).toBe(200);
    });
  });
}
