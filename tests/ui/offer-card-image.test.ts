import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfferCard } from "@/components/OfferCard";
import type { Offer } from "@/lib/offers/types";

// Minimal offer with only the required fields; each test adds what it exercises.
const baseOffer = {
  id: "offer-1",
  bankId: "hnb",
  bankName: "HNB",
  title: "20% off dining",
  description: "Dine and save",
  category: "dining",
  sourceUrl: "https://example.com/offer",
  merchant: "Cafe Lanka",
} as Offer;

describe("OfferCard thumbnail", () => {
  it("renders the thumbnail with empty alt text when imageUrl is set", () => {
    const html = renderToStaticMarkup(
      createElement(OfferCard, { offer: { ...baseOffer, imageUrl: "/offer-images/abc123.webp" } })
    );

    expect(html).toContain("<img");
    expect(html).toContain("abc123.webp");
    expect(html).toContain('alt=""');
  });

  it("renders no image, only the accent rule, when imageUrl is unset", () => {
    const html = renderToStaticMarkup(createElement(OfferCard, { offer: baseOffer }));

    expect(html).not.toContain("<img");
    expect(html).toContain("--offer-rule");
  });
});
