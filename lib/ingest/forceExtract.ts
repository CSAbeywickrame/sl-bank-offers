// Bump when the extraction output changes enough that already-extracted pages should be re-extracted
// (e.g. a new schema field or image pipeline). A FORCE_EXTRACT run then re-does every page recorded
// below this version, and a normal run never looks at it. v1 = extraction-schema-v2 + image pipeline.
export const EXTRACTION_VERSION = 1;

export type BankKind = "crawl" | "feed" | "claude";

export type RunConfigResult =
  | { ok: true; force: boolean; maxDetails: number }
  | { ok: false; error: string };

// Parses MAX_DETAILS_PER_RUN: empty/unset means no cap, anything else must be a positive integer.
export function parseMaxDetails(raw: string | undefined): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { ok: true, value: Infinity };
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return { ok: false, error: `MAX_DETAILS_PER_RUN must be a positive integer (got "${trimmed}").` };
  }
  return { ok: true, value: Number(trimmed) };
}

// Validates the budget/backfill env before any work. Only the exact value "1" forces, and forcing needs
// ONLY_BANKS (a forced all-bank run would re-extract the whole catalog), known bank ids, and no cap on
// non-crawl Claude banks (they have no per-page progress tracking, so a capped forced run could never finish).
export function resolveRunConfig(
  forceEnv: string | undefined,
  maxDetailsEnv: string | undefined,
  onlyBanks: ReadonlySet<string>,
  banks: readonly { bankId: string; kind: BankKind }[],
): RunConfigResult {
  const cap = parseMaxDetails(maxDetailsEnv);
  if (!cap.ok) return cap;
  if (forceEnv !== "1") return { ok: true, force: false, maxDetails: cap.value };
  if (onlyBanks.size === 0) {
    return { ok: false, error: "FORCE_EXTRACT=1 requires ONLY_BANKS (a forced all-bank run would re-extract the whole catalog)." };
  }
  const kindById = new Map(banks.map((b) => [b.bankId, b.kind]));
  const unknown = [...onlyBanks].filter((id) => !kindById.has(id));
  if (unknown.length > 0) {
    return { ok: false, error: `FORCE_EXTRACT: unknown ONLY_BANKS id(s): ${unknown.join(", ")}.` };
  }
  const cappedClaude = [...onlyBanks].filter((id) => kindById.get(id) === "claude");
  if (cap.value !== Infinity && cappedClaude.length > 0) {
    return { ok: false, error: `FORCE_EXTRACT with MAX_DETAILS_PER_RUN is not supported for non-crawl Claude bank(s) ${cappedClaude.join(", ")}: run them uncapped.` };
  }
  return { ok: true, force: true, maxDetails: cap.value };
}
