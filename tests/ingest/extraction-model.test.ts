import { describe, expect, it } from "vitest";
import { EXTRACTION_MODEL } from "@/lib/ingest/extractWithClaude";

describe("extraction model", () => {
  it("uses Claude Haiku 4.5 for offer extraction", () => {
    expect(EXTRACTION_MODEL).toBe("claude-haiku-4-5-20251001");
  });
});
