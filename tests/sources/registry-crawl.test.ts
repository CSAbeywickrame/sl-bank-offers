import { describe, expect, it } from "vitest";
import { bankRegistry } from "@/lib/sources/bankRegistry";

describe("People's Bank crawl recipe", () => {
  it("declares a credit-only category hop and a /promotion/ detail matcher", () => {
    const peoples = bankRegistry.find((b) => b.bankId === "peoples-bank");
    const crawl = peoples?.sources[0]?.crawl;
    expect(crawl).toBeDefined();
    expect(crawl?.hops).toEqual(["/promotion-category/.*cardType=credit_card"]);
    expect(crawl?.detailMatch).toBe("/promotion/[a-z0-9-]+/");
    // The detail matcher must NOT match a category URL.
    expect(new RegExp(crawl!.detailMatch!).test("/promotion-category/wellness/")).toBe(false);
    expect(new RegExp(crawl!.detailMatch!).test("/promotion/keells-25-off-credit/")).toBe(true);
  });
});
