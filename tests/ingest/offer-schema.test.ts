import { describe, expect, it } from "vitest";
import { OFFER_SCHEMA } from "@/lib/ingest/extractWithClaude";

// Regression guard for the outage in RC1: the API rejects OFFER_SCHEMA with 400 "Schema is too
// complex" whenever an optional scalar property is declared AFTER an array-of-enum property, given
// additionalProperties:false and mostly-optional properties (verified against the live API on every
// model). Every array property must therefore stay after every non-array property in this object, or
// extraction silently breaks for every bank on every run.
describe("OFFER_SCHEMA property order", () => {
  it("declares every array-of-enum property after every non-array property", () => {
    const properties = OFFER_SCHEMA.properties.offers.items.properties as Record<string, { type: string }>;
    const keys = Object.keys(properties);
    const arrayKeys = keys.filter((key) => properties[key].type === "array");
    const nonArrayKeys = keys.filter((key) => properties[key].type !== "array");
    expect(arrayKeys.length).toBeGreaterThan(0);
    const firstArrayIndex = keys.indexOf(arrayKeys[0]);
    for (const nonArrayKey of nonArrayKeys) {
      expect(keys.indexOf(nonArrayKey)).toBeLessThan(firstArrayIndex);
    }
    expect(keys.slice(firstArrayIndex)).toEqual(arrayKeys);
  });
});
