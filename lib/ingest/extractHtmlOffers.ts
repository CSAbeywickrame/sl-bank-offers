import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { categorizeOfferText } from "./categorize";
import type { Offer } from "@/lib/offers/types";
import type { BankSource } from "@/lib/sources/bankSources";

const candidateSelector = [
  "article",
  "[class*='offer']",
  "[class*='Offer']",
  "[class*='promotion']",
  "[class*='Promotion']",
  ".promo",
  ".views-row"
].join(", ");

const navigationTerms = [
  "personal banking",
  "business banking",
  "corporate banking",
  "savings accounts",
  "current accounts",
  "fixed deposits",
  "treasury",
  "investment banking",
  "offshore banking"
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(url: string | undefined, sourceUrl: string): string {
  if (!url || url.startsWith("#") || url.startsWith("javascript:")) {
    return sourceUrl;
  }

  try {
    return new URL(url, sourceUrl).toString();
  } catch {
    return sourceUrl;
  }
}

function stableId(source: BankSource, title: string, sourceUrl: string): string {
  const hash = crypto.createHash("sha1").update(`${source.bankId}|${title}|${sourceUrl}`).digest("hex").slice(0, 12);
  return `${source.bankId}-${hash}`;
}

function hashText(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function extractValidUntil(text: string): string | undefined {
  const isoMatch = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!dmyMatch) {
    return undefined;
  }

  const [, day, monthName, year] = dmyMatch;
  const month = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractHtmlOffers(html: string, source: BankSource, sourceUrl: string, nowIso: string): Offer[] {
  const $ = cheerio.load(html);
  const candidates = $(candidateSelector)
    .toArray()
    .map((element) => {
      const node = $(element);
      const text = cleanText(node.text());
      const heading = cleanText(node.find("h1, h2, h3, h4, h5, a, strong").first().text());
      const title = heading.length >= 8 ? heading.slice(0, 140) : text.slice(0, 100);
      const link = absoluteUrl(node.find("a[href]").first().attr("href"), sourceUrl);
      const imageUrl = absoluteUrl(node.find("img[src]").first().attr("src"), sourceUrl);

      return { text, title, link, imageUrl };
    })
    .filter((candidate) => candidate.title.length >= 8 && candidate.text.length >= 20)
    .filter((candidate) => candidate.text.length <= 1200)
    .filter((candidate) => {
      const normalized = candidate.text.toLowerCase();
      const navHits = navigationTerms.filter((term) => normalized.includes(term)).length;
      return navHits < 3;
    })
    .filter((candidate) => /offer|offers|off|discount|valid|cashback|installment|instalment|promotion|deal|save/i.test(candidate.text))
    .slice(0, 120);

  const unique = new Map<string, Offer>();

  for (const candidate of candidates) {
    const id = stableId(source, candidate.title, candidate.link);
    const description = candidate.text.slice(0, 260);
    const imageUrl = candidate.imageUrl === sourceUrl ? undefined : candidate.imageUrl;

    unique.set(id, {
      id,
      bankId: source.bankId,
      bankName: source.bankName,
      title: candidate.title,
      category: categorizeOfferText(candidate.text),
      description,
      validUntil: extractValidUntil(candidate.text),
      sourceUrl: candidate.link,
      imageUrl,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status: "auto_published",
      rawSourceHash: hashText(candidate.text)
    });
  }

  return Array.from(unique.values());
}
