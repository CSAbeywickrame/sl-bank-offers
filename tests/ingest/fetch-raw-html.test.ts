import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRawHtml } from "@/lib/ingest/fetchAndStrip";

afterEach(() => vi.unstubAllGlobals());

describe("fetchRawHtml", () => {
  it("returns the raw HTML body with links intact", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('<a href="/promotion/x/">x</a>', { status: 200 })));
    const html = await fetchRawHtml("https://www.peoplesbank.lk/special-offers/");
    expect(html).toContain('href="/promotion/x/"');
  });
});
