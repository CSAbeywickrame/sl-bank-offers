import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAndStrip, MAX_PDF_BYTES, MAX_IMAGE_BYTES, MAX_PDF_PAGES } from "@/lib/ingest/fetchAndStrip";
import type { RegistrySource } from "@/lib/sources/bankRegistry";

afterEach(() => vi.unstubAllGlobals());

const imageSource: RegistrySource = { url: "https://www.example.lk/banners/dining-promo.jpg", type: "image" };
const pdfSource: RegistrySource = { url: "https://www.example.lk/files/report.pdf", type: "pdf" };

describe("fetchAndStrip — image source", () => {
  it("returns image bytes, the detected media type, and a content hash", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(true);
    expect(res.imageMediaType).toBe("image/jpeg");
    expect(res.imageBytes).toBeInstanceOf(Buffer);
    expect(res.imageBytes).toHaveLength(4);
    expect(res.contentHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("normalizes the non-standard image/jpg content-type to image/jpeg", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/jpg" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(true);
    expect(res.imageMediaType).toBe("image/jpeg");
  });

  it("fails gracefully (does not throw) on a missing or unsupported content-type, unlike treating binary as text/JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/octet-stream" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsupported or missing image content-type/);
  });

  it("rejects an image body larger than MAX_IMAGE_BYTES", async () => {
    const bytes = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(false);
    expect(res.imageBytes).toBeUndefined();
    expect(res.error).toMatch(/too large/);
  });

  it("accepts an image body under MAX_IMAGE_BYTES", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(true);
  });
});

describe("fetchAndStrip — pdf source", () => {
  it("rejects a pdf body larger than MAX_PDF_BYTES", async () => {
    const bytes = Buffer.alloc(MAX_PDF_BYTES + 1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200 })));

    const res = await fetchAndStrip(pdfSource);

    expect(res.ok).toBe(false);
    expect(res.pdfBytes).toBeUndefined();
    expect(res.error).toMatch(/too large/);
  });

  it("accepts a pdf under both the size and page-count limits", async () => {
    const bytes = Buffer.from("%PDF-1.4 /Type /Page /Type /Page %%EOF");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200 })));

    const res = await fetchAndStrip(pdfSource);

    expect(res.ok).toBe(true);
    expect(res.pdfBytes).toBeDefined();
  });

  it("rejects a pdf whose estimated page count exceeds MAX_PDF_PAGES", async () => {
    const bytes = Buffer.from("/Type/Page ".repeat(MAX_PDF_PAGES + 1));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200 })));

    const res = await fetchAndStrip(pdfSource);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too many pages/);
  });
});

describe("fetchAndStrip — static_html source", () => {
  it("returns rawHtml equal to the raw HTML body served by fetch, alongside the stripped text", async () => {
    const html = "<html><body><main>25% off at Keells<img src=\"/banners/promo.jpg\"></main></body></html>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));

    const source: RegistrySource = { url: "https://www.example.lk/offers/", type: "static_html" };
    const res = await fetchAndStrip(source);

    expect(res.ok).toBe(true);
    expect(res.rawHtml).toBe(html);
    expect(res.strippedText).toMatch(/25% off at Keells/);
  });
});
