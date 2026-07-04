import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";
import manifest from "@/app/manifest";
import { Header } from "@/components/Header";

describe("branding assets", () => {
  it("renders the uploaded logo in the header", () => {
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain('src="/brand/sl-card-offers-logo.png"');
    expect(html).toContain('alt="SL Card Offers"');
  });

  it("publishes app icons for browser and install surfaces", () => {
    expect(manifest().icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icon.png",
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/apple-icon.png",
          sizes: "180x180",
          type: "image/png",
        }),
      ])
    );

    expect(metadata.icons).toEqual(
      expect.objectContaining({
        icon: [expect.objectContaining({ url: "/icon.png", type: "image/png" })],
        apple: [expect.objectContaining({ url: "/apple-icon.png", type: "image/png" })],
      })
    );
  });

  it("uses the uploaded favicon asset for the browser icon", () => {
    const iconSha = createHash("sha256").update(readFileSync("app/icon.png")).digest("hex");

    expect(iconSha).toBe("b388d62d7230c12bf3110625fda84bcd5226679ecc4b5e86bc5575e63d7fb1f5");
  });
});
