import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeText } from "@/lib/ingest/textUtils";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import {
  cardKinds,
  cardNetworks,
  cardTierValues,
  offerCategories,
  offerTypes,
  weekdays,
  type OfferCategory,
  type ScannedOffer,
  type Weekday
} from "@/lib/offers/types";
import { isOfferCategory } from "@/lib/offers/categories";
import type { ImageMediaType } from "@/lib/ingest/fetchAndStrip";

export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

export interface ExtractInput {
  entry: BankRegistryEntry;
  sourceUrl: string; // the page/source URL — fallback for an offer's own sourceUrl/termsLink
  strippedText?: string; // for static_html / feed / dynamic_page
  pdfBytes?: Buffer; // for pdf sources
  imageBytes?: Buffer; // for image sources — sent to Claude as vision input
  imageMediaType?: ImageMediaType; // required alongside imageBytes
}

export interface ExtractResult {
  offers: ScannedOffer[];
  inputTokens: number;
  outputTokens: number;
}

interface RawOffer {
  title?: unknown;
  category?: unknown;
  offerType?: unknown;
  description?: unknown;
  merchant?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
  termsLink?: unknown;
  sourceUrl?: unknown;
  discountPct?: unknown;
  discountLabel?: unknown;
  installmentMonths?: unknown;
  minSpend?: unknown;
  maxDiscountAmount?: unknown;
  validDays?: unknown;
  cardNetworks?: unknown;
  cardTypes?: unknown;
  cardTiers?: unknown;
  eligibilityNote?: unknown;
}

// JSON schema for structured output. Structured outputs require additionalProperties:false
// on every object; optional fields are simply omitted from `required`.
const OFFER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["offers"],
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "description", "termsLink", "sourceUrl"],
        properties: {
          title: { type: "string" },
          // The verticals the site browses by. The prompt above defines each one.
          category: { type: "string", enum: [...offerCategories] },
          // How the offer pays out, kept separate from the vertical it belongs to.
          offerType: { type: "string", enum: [...offerTypes] },
          description: { type: "string" },
          merchant: { type: "string" },
          validFrom: { type: "string" },
          validUntil: { type: "string" },
          termsLink: { type: "string" },
          sourceUrl: { type: "string" },
          // Structured terms. All optional: lib/ingest/enrich.ts parses the same values out of the
          // text as a fallback, so an omission costs a regex pass rather than the field.
          discountPct: { type: "number" },
          discountLabel: { type: "string" },
          installmentMonths: { type: "number" },
          minSpend: { type: "number" },
          maxDiscountAmount: { type: "number" },
          validDays: { type: "array", items: { type: "string", enum: [...weekdays] } },
          cardNetworks: { type: "array", items: { type: "string", enum: [...cardNetworks] } },
          cardTypes: { type: "array", items: { type: "string", enum: [...cardKinds] } },
          cardTiers: { type: "array", items: { type: "string", enum: [...cardTierValues] } },
          eligibilityNote: { type: "string" }
        }
      }
    }
  }
} as const;

const SYSTEM_PROMPT = [
  "You extract credit/debit card promotions from a bank's offers page content into a strict JSON schema.",
  "Rules:",
  "- Only include real promotions that are actually present in the supplied content. Never invent offers.",
  "- `category` MUST be one of the allowed enum values. It says WHAT is being bought — the merchant's vertical — and NEVER how the offer is paid for or discounted. An interest-free plan at an electronics store is `electronics`; a cashback offer at a supermarket is `supermarket`.",
  "  - dining: restaurants, cafes, bars, bakeries, food delivery, buffets. A restaurant INSIDE a hotel is dining, not hotels.",
  "  - hotels: hotel and resort STAYS — rooms, villas, half/full-board packages, day outings.",
  "  - travel: flights, airlines, travel agents, tours, cruises, visa services, airport lounges, duty free. Getting there; hotels is staying there.",
  "  - supermarket: supermarkets and grocery chains (Keells, Cargills, Arpico, Spar, Glomark).",
  "  - fuel: fuel stations and fuel purchases.",
  "  - fashion: clothing, footwear, bags, jewellery, watches, textiles.",
  "  - electronics: phones, computers, appliances, TVs, cameras.",
  "  - health: hospitals, clinics, pharmacies, labs, dental, opticians, spas, salons, gyms.",
  "  - home: furniture, homeware, kitchenware, bedding, hardware, paint, tiles, home improvement.",
  "  - automotive: vehicle purchase and servicing, parts, tyres, lubricants.",
  "  - leisure: cinemas, parks, gaming, events, sports gear, toys, books, kids' activities.",
  "  - online: online-only offers on multi-vertical marketplaces (Daraz, PickMe). A single-vertical online store uses its own vertical.",
  "  - other: ONLY when nothing above fits — insurance, telecom, utilities, education, courier, banking services. Most offers ARE classifiable; be reluctant to use other. Never guess a vertical from an uninformative merchant name — prefer other.",
  "- A card network named in the eligibility text (\"for all Visa credit cardholders\") says who qualifies, NOT what is sold. Never let it decide the category.",
  "- `offerType` says HOW the offer pays out: `discount` (a percentage or amount off, special price, free upgrade), `installment` (0%-interest or easy-payment plans — use this when the payment plan IS the offer, not when a discount merely can be paid in instalments), `cashback` (money credited back after the purchase), `bogo` (buy-one-get-one or a free item with purchase), `other` (fee waivers, bonus points, free gifts).",
  "- Set `validFrom`/`validUntil` as YYYY-MM-DD ONLY when a clear date is present in the content; otherwise omit the field.",
  "- The remaining fields are OPTIONAL. Set one ONLY when the content states it outright. Omit anything you would have to infer — a missing field is filled in later from the offer text, but a wrong one is a wrong promise to a cardholder:",
  "  - `discountPct`: the headline discount percentage, above 0 and at most 100 (for \"up to 30%\" use 30). A financing rate is NEVER a discount — \"0% interest\", \"1.2% p.m.\" and \"18% per annum\" are not discounts.",
  "  - `discountLabel`: a short verbatim label ONLY when a bare percentage cannot express the deal (\"Buy 1 Get 1 Free\", \"Rs. 2,000 off\", \"Free room upgrade\"). Omit it when `discountPct` already says everything.",
  "  - `installmentMonths`: for an installment plan, the longest interest-free term in months (\"up to 36 months\" = 36). Omit unless the offer IS a payment plan.",
  "  - `minSpend`: minimum qualifying spend in LKR, as a number.",
  "  - `maxDiscountAmount`: the cap on the SAVING in LKR. A maximum transaction or bill value is a spending ceiling, NOT a discount cap — omit those.",
  "  - `validDays`: only when specific days are named (\"weekends\" = sat,sun; \"weekdays\" = mon-fri). Omit for offers that run every day, and omit rather than listing all seven.",
  "  - `cardNetworks`, `cardTypes`, `cardTiers`: only what the content names (\"Visa Infinite credit cards\" = networks [visa], types [credit], tiers [infinite]).",
  "  - `eligibilityNote`: a short verbatim quote of a real restriction (\"Exclusively for Visa Infinite cardholders\"). Omit when the offer is open to every cardholder.",
  "- `sourceUrl` = the specific offer's detail URL if it appears in the content, otherwise the page URL provided in the message.",
  "- `termsLink` = the terms/detail URL if present, otherwise the same URL as `sourceUrl`.",
  "- `description` = a concise, factual summary of the offer.",
  "- The supplied content may be an image of a promotional flyer or banner instead of page text — if so, carefully read every visible line, including small print, footnotes, and text near logos, before extracting offers.",
  "- Ignore navigation, menus, headers, footers, cookie/consent notices, and clearly expired promotions.",
  "- If the content contains no offers, return an empty `offers` array."
].join("\n");

// Last-resort coercion. The schema enum should make this unreachable, but a row with a category
// the site cannot browse would render on a card and appear in no filter, so anything unrecognised
// becomes "other" rather than being trusted through.
function toCategory(value: unknown): OfferCategory {
  return typeof value === "string" && isOfferCategory(value) ? value : "other";
}

// The schema constrains each field's TYPE but not its range, so a number still has to be checked
// before it reaches the catalog — assertScannedOffer rejects an out-of-range value at load time,
// which would take down the whole site rather than the one bad offer.
function optionalAmount(value: unknown, max?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  if (max !== undefined && value > max) return undefined;
  return value;
}

// Keeps only the members of `allowed`, de-duplicated and in the order `allowed` declares, so two
// extractions of the same offer cannot differ by ordering alone. Undefined when nothing survives.
function optionalMembers<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set(value.filter((entry): entry is T => allowed.includes(entry as T)));
  const ordered = allowed.filter((entry) => seen.has(entry));
  return ordered.length > 0 ? ordered : undefined;
}

function optionalMember<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

// All seven days is not a restriction — it means the offer runs every day, which an absent field
// already says. Keeping it would make a day filter look like it had a real signal to match on.
function optionalDays(value: unknown): Weekday[] | undefined {
  const days = optionalMembers(value, weekdays);
  return days && days.length < weekdays.length ? days : undefined;
}

// Drops the keys that came back undefined, so an unparsed field stays absent from the JSON rather
// than being written as an explicit null.
function optionalFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Returns a trimmed string when value is a non-empty string, otherwise undefined.
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Builds a stable, unique id from bankId + title + sourceUrl.
function buildId(bankId: string, title: string, sourceUrl: string): string {
  const hash = crypto.createHash("sha1").update(`${bankId}|${title}|${sourceUrl}`).digest("hex").slice(0, 12);
  return `${bankId}-${hash}`;
}

// Extracts the JSON text payload from the model response.
function readResponseText(message: Anthropic.Message): string {
  const textBlock = message.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  return textBlock?.text ?? "";
}

// Calls Claude once and returns normalized offers + token usage. Throws on API error (caller wraps in try/catch).
export async function extractOffers(
  input: ExtractInput,
  client: Anthropic,
  reviewDateIso: string
): Promise<ExtractResult> {
  const { entry, sourceUrl } = input;

  // Guard against a wasted API call: callers must supply page text, a PDF, or an image.
  if (!input.pdfBytes && !input.imageBytes && !input.strippedText) {
    throw new Error(`extractOffers: no content for ${entry.bankId} / ${sourceUrl}`);
  }

  const userContent: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `Bank: ${entry.bank.name}\nPage URL: ${sourceUrl}\n\nExtract all current card offers from the content below.`
    }
  ];

  if (input.pdfBytes) {
    userContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBytes.toString("base64") }
    });
  } else if (input.imageBytes && input.imageMediaType) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: input.imageMediaType, data: input.imageBytes.toString("base64") }
    });
  } else {
    userContent.push({ type: "text", text: input.strippedText ?? "" });
  }

  // Stream with a high cap: offer-heavy banks produce large JSON, and >16K output requires
  // streaming to avoid SDK HTTP timeouts. Output is billed per actual token, so the high cap is free.
  const stream = client.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: 64000,
    thinking: { type: "disabled" },
    // `effort` is not accepted by all models (e.g. Haiku 4.5 rejects it); omit it so the extractor
    // is model-agnostic. `format` (structured JSON schema output) is supported on Haiku and Sonnet.
    output_config: { format: { type: "json_schema", schema: OFFER_SCHEMA } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }]
  });
  const message = await stream.finalMessage();

  // A truncated response yields invalid JSON; fail loudly instead of silently dropping offers.
  if (message.stop_reason === "max_tokens") {
    throw new Error(`extraction truncated at max_tokens for ${entry.bankId} / ${sourceUrl}`);
  }

  const parsed = JSON.parse(readResponseText(message) || "{}") as { offers?: RawOffer[] };
  const rawOffers = Array.isArray(parsed.offers) ? parsed.offers : [];

  const byId = new Map<string, ScannedOffer>();
  for (const raw of rawOffers) {
    const title = normalizeText(typeof raw.title === "string" ? raw.title : "");
    const description = normalizeText(typeof raw.description === "string" ? raw.description : "");
    if (!title) {
      continue;
    }

    const offerSourceUrl = optionalString(raw.sourceUrl) ?? sourceUrl;
    const termsLink = optionalString(raw.termsLink) ?? offerSourceUrl;

    const offer: ScannedOffer = {
      id: buildId(entry.bankId, title, offerSourceUrl),
      bankId: entry.bankId,
      cardId: entry.defaultCardId,
      title,
      category: toCategory(raw.category),
      description,
      merchant: optionalString(raw.merchant),
      validFrom: optionalString(raw.validFrom),
      validUntil: optionalString(raw.validUntil),
      termsLink,
      sourceUrl: offerSourceUrl,
      lastReviewedAt: reviewDateIso,
      status: "active",
      // Only what the model asserted. Whatever it left out, enrichOffer parses from the title and
      // description during import — and it fills blanks only, so these values win where present.
      ...optionalFields({
        offerType: optionalMember(raw.offerType, offerTypes),
        discountPct: optionalAmount(raw.discountPct, 100),
        discountLabel: optionalString(raw.discountLabel),
        installmentMonths: optionalAmount(raw.installmentMonths, 120),
        minSpend: optionalAmount(raw.minSpend),
        maxDiscountAmount: optionalAmount(raw.maxDiscountAmount),
        validDays: optionalDays(raw.validDays),
        cardNetworks: optionalMembers(raw.cardNetworks, cardNetworks),
        cardTypes: optionalMembers(raw.cardTypes, cardKinds),
        cardTiers: optionalMembers(raw.cardTiers, cardTierValues),
        eligibilityNote: optionalString(raw.eligibilityNote)
      })
    };

    byId.set(offer.id, offer);
  }

  return {
    offers: [...byId.values()],
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0
  };
}
