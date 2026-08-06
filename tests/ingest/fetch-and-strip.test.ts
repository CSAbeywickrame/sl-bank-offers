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

describe("fetchAndStrip — feed source", () => {
  const feedSource: RegistrySource = { url: "https://www.sampath.lk/api/card-promotions?category=visa_offers&page_number=1&size=500", type: "feed" };

  it("returns ok:false with an honest error when a self-inconsistent feed (total>0, empty data) never recovers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [], total: 97 }), { status: 200 })));
    vi.useFakeTimers();
    try {
      const resPromise = fetchAndStrip(feedSource);
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/97/);
      expect(res.error).toMatch(/0 rows/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers and returns the populated payload once a retry serves non-empty data", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify({ data: [], total: 97 }), { status: 200 }))
      .mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: 1 }], total: 97 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    try {
      const resPromise = fetchAndStrip(feedSource);
      await vi.runAllTimersAsync();
      const res = await resPromise;

      expect(res.ok).toBe(true);
      expect(res.strippedText).toContain('[{"id":1}]');
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a legitimately empty category (total:0) as ok on the first attempt, with no retry", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchAndStrip(feedSource);

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves a non-envelope feed shape (bare array body) unaffected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 })));

    const res = await fetchAndStrip(feedSource);

    expect(res.ok).toBe(true);
  });
});

describe("fetchAndStrip — source headers", () => {
  it("applies a source's extra headers (e.g. locale) to the outgoing request", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const source: RegistrySource = { url: "https://www.sampath.lk/api/card-promotions", type: "feed", headers: { locale: "en" } };
    await fetchAndStrip(source);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("locale")).toBe("en");
  });

  it("keeps the project User-Agent and does not let a source's own user-agent header override it", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response("<html></html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const source: RegistrySource = {
      url: "https://www.example.lk/offers/",
      type: "static_html",
      headers: { "user-agent": "something-else" }
    };
    await fetchAndStrip(source);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("user-agent")).toBe("SLBankOffersBot/0.1 (+https://github.com/CSAbeywickrame/sl-bank-offers)");
  });

  it("still works exactly as before for a source with no headers field (regression)", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } })));

    const res = await fetchAndStrip(imageSource);

    expect(res.ok).toBe(true);
  });
});
