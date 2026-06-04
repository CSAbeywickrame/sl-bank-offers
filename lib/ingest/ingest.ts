import { extractHtmlOffers } from "./extractHtmlOffers";
import { mergeOffers, readStoredOffers, writeStoredOffers } from "./persist";
import type { Offer } from "@/lib/offers/types";
import { bankSources } from "@/lib/sources/bankSources";

export interface RefreshFailure {
  bankId: string;
  url: string;
  message: string;
}

export interface RefreshSummary {
  banksChecked: number;
  offersFound: number;
  offersSaved: number;
  failures: RefreshFailure[];
}

async function fetchSource(url: string): Promise<{ body: string; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "SLBankOffersBot/0.1 (+https://github.com/CSAbeywickrame/sl-bank-offers)"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") ?? ""
  };
}

export async function refreshOffers(nowIso = new Date().toISOString()): Promise<RefreshSummary> {
  const existing = readStoredOffers();
  const incoming: Offer[] = [];
  const failures: RefreshFailure[] = [];
  let banksChecked = 0;

  for (const source of bankSources.filter((item) => item.enabled)) {
    banksChecked += 1;

    for (const url of source.urls) {
      try {
        const { body, contentType } = await fetchSource(url);

        if (source.sourceType === "pdf_or_image" || (contentType && !contentType.includes("text/html"))) {
          failures.push({
            bankId: source.bankId,
            url,
            message: `Unsupported content type: ${contentType || source.sourceType}`
          });
          continue;
        }

        incoming.push(...extractHtmlOffers(body, source, url, nowIso));
      } catch (error) {
        failures.push({
          bankId: source.bankId,
          url,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }

  const merged = mergeOffers(existing, incoming, nowIso);
  writeStoredOffers(merged);

  return {
    banksChecked,
    offersFound: incoming.length,
    offersSaved: merged.length,
    failures
  };
}
