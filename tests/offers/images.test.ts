import { describe, expect, it } from "vitest";
import { absoluteImageUrl } from "@/lib/offers/images";

describe("absoluteImageUrl", () => {
  it("joins a root-relative path onto the site url", () => {
    expect(absoluteImageUrl("/offer-images/a.webp", "https://example.com")).toBe(
      "https://example.com/offer-images/a.webp"
    );
  });

  it("does not double the slash when the site url has a trailing slash", () => {
    expect(absoluteImageUrl("/offer-images/a.webp", "https://example.com/")).toBe(
      "https://example.com/offer-images/a.webp"
    );
  });

  it("returns absolute http(s) urls unchanged", () => {
    expect(absoluteImageUrl("https://cdn.example.com/a.webp", "https://example.com")).toBe(
      "https://cdn.example.com/a.webp"
    );
    expect(absoluteImageUrl("http://cdn.example.com/a.webp", "https://example.com")).toBe(
      "http://cdn.example.com/a.webp"
    );
  });
});
