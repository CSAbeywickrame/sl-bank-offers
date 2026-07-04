import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAndStrip } from "@/lib/ingest/fetchAndStrip";
import type { RegistrySource } from "@/lib/sources/bankRegistry";

afterEach(() => vi.unstubAllGlobals());

const imageSource: RegistrySource = { url: "https://www.example.lk/banners/dining-promo.jpg", type: "image" };

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
});
