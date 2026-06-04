import { describe, expect, it } from "vitest";
import { categorizeOfferText } from "@/lib/ingest/categorize";

describe("categorizeOfferText", () => {
  it("detects dining offers", () => {
    expect(categorizeOfferText("Enjoy dining discounts at restaurants and cafes")).toBe("dining");
  });

  it("detects hotel offers", () => {
    expect(categorizeOfferText("Save on hotel stays and resort bookings")).toBe("hotels");
  });

  it("falls back to other when no category matches", () => {
    expect(categorizeOfferText("Special card benefits for selected purchases")).toBe("other");
  });
});
