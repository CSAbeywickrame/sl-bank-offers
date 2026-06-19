import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { RegistrySource } from "@/lib/sources/bankRegistry";
import { normalizeText } from "@/lib/ingest/textUtils";

const USER_AGENT = "SLBankOffersBot/0.1 (+https://github.com/CSAbeywickrame/sl-bank-offers)";
const CRAWL_THROTTLE_MS = 300;

export interface FetchResult {
  ok: boolean;
  strippedText?: string;
  pdfBytes?: Buffer;
  contentHash?: string;
  error?: string;
}

// Resolves after the given number of milliseconds
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Returns the sha1 hex digest of a string or Buffer
export function hashContent(input: string | Buffer): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

// Fetches a URL with a timeout and UA header, retrying once on non-2xx response or network error
async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 20000): Promise<Response> {
  const headers = new Headers((opts.headers as HeadersInit | undefined) ?? {});
  headers.set("user-agent", USER_AGENT);

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, headers, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const res = await attempt();
    if (!res.ok) {
      await sleep(1000);
      const retried = await attempt();
      if (!retried.ok) {
        throw new Error(`HTTP ${retried.status}`);
      }
      return retried;
    }
    return res;
  } catch {
    await sleep(1000);
    const retried = await attempt();
    if (!retried.ok) {
      throw new Error(`HTTP ${retried.status}`);
    }
    return retried;
  }
}

// Fetches a URL and returns the raw HTML (links intact) for crawling. Throttled for politeness; throws on failure.
export async function fetchRawHtml(url: string): Promise<string> {
  await sleep(CRAWL_THROTTLE_MS);
  const res = await fetchWithTimeout(url, {});
  return res.text();
}

// Strips HTML noise tags and returns normalized plain text from the body
function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, svg, iframe, form").remove();
  const raw = $("body").length ? $("body").text() : $.root().text();
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return normalizeText(collapsed);
}

// Fetches one registry source and returns stripped content plus a content hash, never throws
export async function fetchAndStrip(source: RegistrySource): Promise<FetchResult> {
  try {
    if (source.type === "static_html") {
      const res = await fetchWithTimeout(source.url, {});
      const html = await res.text();
      const strippedText = stripHtml(html);
      const contentHash = hashContent(strippedText);
      return { ok: true, strippedText, contentHash };
    }

    if (source.type === "feed") {
      const res = await fetchWithTimeout(source.url, {});
      const strippedText = await res.text();
      // Validate it is parseable JSON before returning; throws on malformed feed
      JSON.parse(strippedText);
      const contentHash = hashContent(strippedText);
      return { ok: true, strippedText, contentHash };
    }

    if (source.type === "pdf") {
      const res = await fetchWithTimeout(source.url, {});
      const pdfBytes = Buffer.from(await res.arrayBuffer());
      const contentHash = hashContent(pdfBytes);
      return { ok: true, pdfBytes, contentHash };
    }

    if (source.type === "dynamic_page") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chromium: any;
      try {
        ({ chromium } = await import("@playwright/test"));
      } catch {
        return { ok: false, error: "playwright unavailable" };
      }
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        // Use domcontentloaded (networkidle never fires on SPAs with constant background traffic),
        // then let client-side rendering settle before reading the DOM.
        await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(3000);
        const html = await page.content();
        const strippedText = stripHtml(html);
        const contentHash = hashContent(strippedText);
        return { ok: true, strippedText, contentHash };
      } finally {
        await browser.close();
      }
    }

    return { ok: false, error: `unsupported source type: ${source.type}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
