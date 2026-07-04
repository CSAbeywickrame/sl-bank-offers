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
