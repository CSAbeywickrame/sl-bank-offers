import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { extractOffers, type ExtractInput } from "@/lib/ingest/extractWithClaude";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";

const entry = {
  bankId: "example-bank",
  enabled: true,
  bank: { id: "example-bank", name: "Example Bank", shortName: "Example", websiteUrl: "https://www.example.lk" },
  cards: [{ id: "example-bank-credit-cards", bankId: "example-bank", name: "Example Bank Credit Cards" }],
  defaultCardId: "example-bank-credit-cards",
  sources: [],
} as unknown as BankRegistryEntry;

const reviewDate = "2026-07-04T00:00:00.000Z";

// Builds a fake Anthropic client whose messages.stream(...) resolves to a canned final message; captures the call args for inspection.
function fakeClient(offers: unknown[]) {
  const message = {
    content: [{ type: "text", text: JSON.stringify({ offers }) }],
    stop_reason: "end_turn",
    usage: { input_tokens: 500, output_tokens: 120 },
  };
  const stream = vi.fn((_params: unknown) => ({ finalMessage: async () => message }));
  const client = { messages: { stream } } as unknown as Anthropic;
  return { client, stream };
}

describe("extractOffers — image input", () => {
  const baseInput: ExtractInput = {
    entry,
    sourceUrl: "https://www.example.lk/banners/dining-promo.jpg",
    imageBytes: Buffer.from("fake-flyer-bytes"),
    imageMediaType: "image/jpeg",
  };

  it("sends the image as a base64 vision content block to Claude", async () => {
    const { client, stream } = fakeClient([]);
    await extractOffers(baseInput, client, reviewDate);

    const callArgs = stream.mock.calls[0]?.[0] as { messages: Array<{ content: Array<Record<string, unknown>> }> };
    const userContent = callArgs.messages[0]?.content ?? [];
    const imageBlock = userContent.find((block) => block.type === "image");

    expect(imageBlock).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: Buffer.from("fake-flyer-bytes").toString("base64") },
    });
  });

  it("returns parsed offers from the mocked vision response", async () => {
    const { client } = fakeClient([
      {
        title: "20% off at Pizza Hut",
        category: "dining",
        description: "20% off all orders",
        termsLink: "https://www.example.lk/banners/dining-promo.jpg",
        sourceUrl: "https://www.example.lk/banners/dining-promo.jpg",
      },
    ]);

    const result = await extractOffers(baseInput, client, reviewDate);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.title).toBe("20% off at Pizza Hut");
    expect(result.offers[0]?.bankId).toBe("example-bank");
    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(120);
  });

  it("applies the same title/category normalization as the PDF and text paths (drops empty-title offers)", async () => {
    const { client } = fakeClient([
      { title: "", category: "dining", description: "no title, should be dropped" },
      { title: "Free dessert at Cafe X", category: "dining", description: "with any purchase" },
    ]);

    const result = await extractOffers(baseInput, client, reviewDate);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.title).toBe("Free dessert at Cafe X");
  });

  it("throws when neither text, PDF, nor image content is supplied", async () => {
    const { client } = fakeClient([]);
    await expect(
      extractOffers({ entry, sourceUrl: baseInput.sourceUrl }, client, reviewDate),
    ).rejects.toThrow(/no content/);
  });
});

describe("extractOffers — structured enrichment fields", () => {
  const textInput: ExtractInput = {
    entry,
    sourceUrl: "https://www.example.lk/offers",
    strippedText: "offers page text",
  };
  const baseOffer = {
    title: "25% off at Blue Orbit",
    category: "dining",
    description: "25% off the dinner buffet.",
    termsLink: "https://www.example.lk/offers/blue-orbit",
    sourceUrl: "https://www.example.lk/offers/blue-orbit",
  };
  const extractOne = async (overrides: Record<string, unknown>) => {
    const { client } = fakeClient([{ ...baseOffer, ...overrides }]);
    const { offers } = await extractOffers(textInput, client, reviewDate);
    return offers[0];
  };

  it("keeps every structured field the model asserted", async () => {
    const offer = await extractOne({
      offerType: "discount",
      discountPct: 25,
      minSpend: 5000,
      maxDiscountAmount: 1250,
      validDays: ["fri", "sat"],
      cardNetworks: ["visa"],
      cardTypes: ["credit"],
      cardTiers: ["infinite"],
      eligibilityNote: "Exclusively for Visa Infinite cardholders",
    });
    expect(offer).toMatchObject({
      offerType: "discount",
      discountPct: 25,
      minSpend: 5000,
      maxDiscountAmount: 1250,
      validDays: ["fri", "sat"],
      cardNetworks: ["visa"],
      cardTypes: ["credit"],
      cardTiers: ["infinite"],
      eligibilityNote: "Exclusively for Visa Infinite cardholders",
    });
  });

  // Absent is the normal case, and it must stay absent rather than becoming an explicit undefined
  // key: enrichOffer fills blanks during import, and a present-but-undefined key is not a blank.
  it("omits a field the model did not assert", async () => {
    const offer = await extractOne({});
    for (const key of ["discountPct", "minSpend", "validDays", "cardTiers", "eligibilityNote"]) {
      expect(offer).not.toHaveProperty(key);
    }
  });

  // The schema pins types, not ranges. assertScannedOffer rejects an out-of-range value at load
  // time, which takes down the whole catalog rather than the one bad offer.
  it("drops a numeric value the catalog would refuse to load", async () => {
    expect(await extractOne({ discountPct: 150 })).not.toHaveProperty("discountPct");
    expect(await extractOne({ discountPct: 0 })).not.toHaveProperty("discountPct");
    expect(await extractOne({ minSpend: -5 })).not.toHaveProperty("minSpend");
    expect(await extractOne({ maxDiscountAmount: 0 })).not.toHaveProperty("maxDiscountAmount");
  });

  it("drops enum values that are not ours and keeps the rest", async () => {
    const offer = await extractOne({ cardNetworks: ["visa", "sampath-card"], offerType: "freebie" });
    expect(offer.cardNetworks).toEqual(["visa"]);
    expect(offer).not.toHaveProperty("offerType");
  });

  // Two extractions of one offer must not differ by ordering alone, or dedupe sees two rows.
  it("normalises member order and removes duplicates", async () => {
    const offer = await extractOne({ cardTypes: ["debit", "credit", "debit"], validDays: ["sun", "mon"] });
    expect(offer.cardTypes).toEqual(["credit", "debit"]);
    expect(offer.validDays).toEqual(["mon", "sun"]);
  });

  // All seven days means "runs every day", which an absent field already says. Keeping it would
  // make a day filter look like it had a real signal to match on.
  it("treats all seven days as no restriction at all", async () => {
    const offer = await extractOne({ validDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] });
    expect(offer).not.toHaveProperty("validDays");
  });

  it("asks the model for the fields in its prompt", async () => {
    const { client, stream } = fakeClient([]);
    await extractOffers(textInput, client, reviewDate);
    const params = stream.mock.calls[0][0] as { system: Array<{ text: string }>; output_config: { format: { schema: { properties: { offers: { items: { properties: Record<string, unknown> } } } } } } };
    const prompt = params.system[0].text;
    expect(prompt).toContain("offerType");
    expect(prompt).toContain("A financing rate is NEVER a discount");
    expect(prompt).toContain("NOT a discount cap");
    const schemaProps = params.output_config.format.schema.properties.offers.items.properties;
    for (const field of ["offerType", "discountPct", "minSpend", "maxDiscountAmount", "validDays", "cardNetworks", "cardTypes", "cardTiers", "eligibilityNote"]) {
      expect(schemaProps).toHaveProperty(field);
    }
  });
});
