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

    expect(iconSha).toBe("e62e765f170af3a1ebd49dc6c36c86b7ebb59938e96d90b8f0c5489a219fc9fb");
  });
});
