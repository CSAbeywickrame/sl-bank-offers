import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeText } from "@/lib/ingest/textUtils";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import { offerCategories, type OfferCategory, type ScannedOffer } from "@/lib/offers/types";
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
  description?: unknown;
  merchant?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
  termsLink?: unknown;
  sourceUrl?: unknown;
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
          category: { type: "string", enum: [...offerCategories] },
          description: { type: "string" },
          merchant: { type: "string" },
          validFrom: { type: "string" },
          validUntil: { type: "string" },
          termsLink: { type: "string" },
          sourceUrl: { type: "string" }
        }
      }
    }
  }
} as const;

const SYSTEM_PROMPT = [
  "You extract credit/debit card promotions from a bank's offers page content into a strict JSON schema.",
  "Rules:",
  "- Only include real promotions that are actually present in the supplied content. Never invent offers.",
  "- `category` MUST be one of the allowed enum values; pick the closest fit, otherwise use \"other\".",
  "- Set `validFrom`/`validUntil` as YYYY-MM-DD ONLY when a clear date is present in the content; otherwise omit the field.",
  "- `sourceUrl` = the specific offer's detail URL if it appears in the content, otherwise the page URL provided in the message.",
  "- `termsLink` = the terms/detail URL if present, otherwise the same URL as `sourceUrl`.",
  "- `description` = a concise, factual summary of the offer.",
  "- The supplied content may be an image of a promotional flyer or banner instead of page text — if so, carefully read every visible line, including small print, footnotes, and text near logos, before extracting offers.",
  "- Ignore navigation, menus, headers, footers, cookie/consent notices, and clearly expired promotions.",
  "- If the content contains no offers, return an empty `offers` array."
].join("\n");

// Returns true when value is one of the allowed offer categories.
function toCategory(value: unknown): OfferCategory {
  return offerCategories.includes(value as OfferCategory) ? (value as OfferCategory) : "other";
}

// Returns a trimmed string when value is a non-empty string, otherwise undefined.
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Builds a stable, unique id from bankId + title + sourceUrl (mirrors extractHtmlOffers).
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
      status: "active"
    };

    byId.set(offer.id, offer);
  }

  return {
    offers: [...byId.values()],
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0
  };
}
