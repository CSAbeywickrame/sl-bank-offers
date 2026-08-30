import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OfferEnrichment } from "@/lib/offers/types";

/**
 * toOffer() copies the catalog row into the runtime shape field by field, so every enrichment
 * field needs a line there. A field added to OfferEnrichment but forgotten in toOffer type-checks,
 * passes every other test, and is simply absent from the UI forever — which is exactly what
 * happened to installmentMonths: it was parsed, stored on 897 offers, and never rendered.
 *
 * Reading the source is blunt, but it is the only way to catch an omission that TypeScript
 * considers valid. The alternative — a spread — would silently leak stored-only fields into the
 * runtime object, which is what the explicit mapping is there to prevent.
 */
describe("every enrichment field reaches the UI", () => {
  const source = readFileSync(join(process.cwd(), "lib", "offers", "repository.ts"), "utf8");
  const toOfferBody = source.slice(source.indexOf("function toOffer"), source.indexOf("export async function getSeedData"));

  // Keys of OfferEnrichment, mirrored here because a type cannot be enumerated at runtime. Adding a
  // field to OfferEnrichment means adding it here too — and that is the point: the addition is
  // deliberate in both places, or this test fails.
  const enrichmentFields: Array<keyof OfferEnrichment> = [
    "offerType",
    "discountPct",
    "discountLabel",
    "installmentMonths",
    "minSpend",
    "maxDiscountAmount",
    "validDays",
    "cardNetworks",
    "cardTypes",
    "cardTiers",
    "eligibilityNote"
  ];

  it.each(enrichmentFields)("toOffer passes through %s", (field) => {
    expect(toOfferBody).toContain(`${field}: catalogOffer.${field}`);
  });
});
