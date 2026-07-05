import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { RegistrySource } from "@/lib/sources/bankRegistry";
import { normalizeText } from "@/lib/ingest/textUtils";

const USER_AGENT = "SLBankOffersBot/0.1 (+https://github.com/CSAbeywickrame/sl-bank-offers)";
const CRAWL_THROTTLE_MS = 300;

// Largest pdf byte size accepted before it is rejected as too large to safely process.
export const MAX_PDF_BYTES = 32 * 1024 * 1024;
// Largest image byte size accepted before it is rejected as too large to safely process.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Largest estimated pdf page count accepted before it is rejected as too large to safely process.
export const MAX_PDF_PAGES = 100;

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface FetchResult {
  ok: boolean;
  strippedText?: string;
  pdfBytes?: Buffer;
  imageBytes?: Buffer;
  imageMediaType?: ImageMediaType;
  contentHash?: string;
  rawHtml?: string; // raw HTML for static_html/dynamic_page sources, so callers can scan it for assets without a second fetch
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

const SUPPORTED_IMAGE_MEDIA_TYPES: ReadonlySet<ImageMediaType> = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Normalizes a response Content-Type header into a Claude-supported image media type, or null when missing/unsupported
function resolveImageMediaType(contentType: string | null): ImageMediaType | null {
  const base = contentType?.split(";")[0]?.trim().toLowerCase();
  const normalized = base === "image/jpg" ? "image/jpeg" : base;
  return SUPPORTED_IMAGE_MEDIA_TYPES.has(normalized as ImageMediaType) ? (normalized as ImageMediaType) : null;
}

// Best-effort page count for a PDF: counts uncompressed /Type/Page markers (latin1 decode).
// Heuristic-only — compressed object streams make this under-count, so it never falsely rejects.
function estimatePdfPageCount(bytes: Buffer): number {
  const text = bytes.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

// Fetches one registry source and returns stripped content plus a content hash, never throws
export async function fetchAndStrip(source: RegistrySource): Promise<FetchResult> {
  try {
    if (source.type === "static_html") {
      const res = await fetchWithTimeout(source.url, {});
      const html = await res.text();
      const strippedText = stripHtml(html);
      const contentHash = hashContent(strippedText);
      return { ok: true, strippedText, contentHash, rawHtml: html };
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
      if (pdfBytes.length > MAX_PDF_BYTES) {
        return { ok: false, error: `pdf too large: ${pdfBytes.length} bytes (max ${MAX_PDF_BYTES})` };
      }
      const pageCount = estimatePdfPageCount(pdfBytes);
      if (pageCount > MAX_PDF_PAGES) {
        return { ok: false, error: `pdf too many pages (~${pageCount} > ${MAX_PDF_PAGES})` };
      }
      const contentHash = hashContent(pdfBytes);
      return { ok: true, pdfBytes, contentHash };
    }

    if (source.type === "image") {
      const res = await fetchWithTimeout(source.url, {});
      const imageMediaType = resolveImageMediaType(res.headers.get("content-type"));
      if (!imageMediaType) {
        return { ok: false, error: `unsupported or missing image content-type for ${source.url}` };
      }
      const imageBytes = Buffer.from(await res.arrayBuffer());
      if (imageBytes.length > MAX_IMAGE_BYTES) {
        return { ok: false, error: `image too large: ${imageBytes.length} bytes (max ${MAX_IMAGE_BYTES})` };
      }
      const contentHash = hashContent(imageBytes);
      return { ok: true, imageBytes, imageMediaType, contentHash };
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
        return { ok: true, strippedText, contentHash, rawHtml: html };
      } finally {
        await browser.close();
      }
    }

    return { ok: false, error: `unsupported source type: ${source.type}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
