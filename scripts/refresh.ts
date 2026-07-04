import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { bankRegistry, type BankRegistryEntry, type RegistrySource } from "@/lib/sources/bankRegistry";
import { fetchAndStrip, hashContent, fetchRawHtml, type FetchResult } from "@/lib/ingest/fetchAndStrip";
import { refreshCrawlBank, discoverCrawlUrls } from "@/lib/ingest/crawlExtract";
import { extractOffers } from "@/lib/ingest/extractWithClaude";
import { expireLapsedOffers, importBankOffers, isActiveOffer, reconcileOrphans, removeBank } from "@/lib/ingest/importBank";
import { feedMappers } from "@/lib/ingest/feedMappers";
import type { ScannedOffer, ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

const MIN_CONTENT_CHARS = 200;
// Sanity gate: reject a catalog replace only when a bank that HAD a real catalog collapses to near-zero
// (the signature of a broken scrape, e.g. a page that failed to render). A ratio test is deliberately
// NOT used: legitimate seasonal contraction (Christmas/New-Year offers expiring) produces a smaller but
// realistic count, which must pass. Only a collapse to <= the floor fails. Override with SANITY_OVERRIDE=bankId.
const SANITY_MIN_BASELINE = 10;
const SANITY_COLLAPSE_FLOOR = 3;
const dataDir = join(process.cwd(), "data");
const seedPath = join(dataDir, "seed.json");
const scannedPath = join(dataDir, "scanned-offers.json");
const statePath = join(dataDir, "refresh-state.json");
const reportPath = join(dataDir, "refresh-report.json");

type BankStatus = "updated" | "unchanged" | "skipped-empty" | "fetch-failed" | "extract-failed" | "deferred" | "disabled" | "sanity-rejected";

interface RefreshState {
  lastRunAt: string;
  banks: Record<string, { hash?: string; lastUpdatedAt: string; details?: Record<string, string> }>;
}

interface BankReport {
  status: BankStatus;
  sources: string[];
  message?: string;
  offersWritten?: number;
  assetFailures?: { url: string; reason: string }[];
}

interface RefreshReport {
  runAt: string;
  tokensUsed: { input: number; output: number };
  banks: Record<string, BankReport>;
}

// Reads a JSON file, returning the fallback when it does not exist.
function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// Writes a value as pretty JSON with a trailing newline.
function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const reviewDateIso = new Date().toISOString();
  // Caps how many banks reach Claude this run. Note: a multi-source bank spends one call per
  // source, so a bank with N sources costs up to N calls against this single-bank budget unit.
  const maxBanks = Number(process.env.MAX_BANKS_PER_RUN ?? "") || Infinity;
  // Bank ids allowed to bypass the sanity gate this run (accept a real drop in offer count).
  const sanityOverride = new Set((process.env.SANITY_OVERRIDE ?? "").split(",").map(s => s.trim()).filter(Boolean));
  for (const id of sanityOverride) {
    if (!bankRegistry.some(e => e.bankId === id)) console.warn(`SANITY_OVERRIDE: unknown bankId "${id}" — no registry match (check the slug)`);
  }
  const onlyBanks = new Set((process.env.ONLY_BANKS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const maxDetails = Number(process.env.MAX_DETAILS_PER_RUN ?? "") || Infinity;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic() : null;

  let seed = readJson<SeedData>(seedPath, { banks: [], cards: [], offers: [] });
  let catalog = readJson<ScannedOfferCatalog>(scannedPath, { version: 1, updatedAt: reviewDateIso, offers: [] });
  const state = readJson<RefreshState>(statePath, { lastRunAt: "", banks: {} });

  const report: RefreshReport = { runAt: reviewDateIso, tokensUsed: { input: 0, output: 0 }, banks: {} };
  let extractedCount = 0;

  for (const entry of bankRegistry) {
    if (onlyBanks.size > 0 && !onlyBanks.has(entry.bankId)) continue;
    const sourceUrls = entry.sources.map(s => s.url);

    // Retire disabled banks: remove their rows once, then skip.
    if (!entry.enabled) {
      ({ seed, catalog } = removeBank(entry, reviewDateIso, seed, catalog));
      report.banks[entry.bankId] = { status: "disabled", sources: sourceUrls };
      continue;
    }

    try {
      // Crawl branch: a source with a `crawl` recipe is walked to its detail pages, each hash-gated
      // so only new/changed pages reach Claude. Keeps existing rows on any discovery/fetch failure.
      const crawlSource = entry.sources.find((s) => s.crawl);
      if (crawlSource?.crawl) {
        if (!client) {
          report.banks[entry.bankId] = { status: "deferred", sources: sourceUrls, message: "ANTHROPIC_API_KEY not set" };
          continue;
        }
        const recipe = crawlSource.crawl;
        const seedUrls = entry.sources.filter((s) => s.crawl).map((s) => s.url);
        const snapshot = catalog.offers.filter((o) => o.bankId === entry.bankId);
        const prevHashes = state.banks[entry.bankId]?.details ?? {};
        const result = await refreshCrawlBank(entry, snapshot, prevHashes, reviewDateIso, {
          discover: () => discoverCrawlUrls(seedUrls, recipe, fetchRawHtml),
          fetchDetail: (url, type) => fetchAndStrip({ url, type }),
          extract: async (sourceUrl, fetched) => {
            const ex = await extractOffers({ entry, sourceUrl, ...fetched }, client, reviewDateIso);
            return { offers: ex.offers, inputTokens: ex.inputTokens, outputTokens: ex.outputTokens };
          },
          throttleMs: 300,
          maxExtractions: maxDetails,
        });
        report.tokensUsed.input += result.inputTokens;
        report.tokensUsed.output += result.outputTokens;
        if (!result.ok) {
          report.banks[entry.bankId] = {
            status: "fetch-failed", sources: sourceUrls, message: result.error,
            ...(result.assetFailures.length > 0 ? { assetFailures: result.assetFailures } : {}),
          };
          continue;
        }
        const activeOffers = result.offers.filter((o) => isActiveOffer(o.validUntil, reviewDateIso));
        if (activeOffers.length === 0) {
          report.banks[entry.bankId] = {
            status: "extract-failed", sources: sourceUrls, message: "crawl returned no active offers",
            ...(result.assetFailures.length > 0 ? { assetFailures: result.assetFailures } : {}),
          };
          continue;
        }
        const currentCount = countBankOffers(seed, entry);
        const dedupedOffers = dedupeById(activeOffers);
        const newCount = dedupedOffers.length;
        if (!sanityOverride.has(entry.bankId) && currentCount >= SANITY_MIN_BASELINE && newCount <= SANITY_COLLAPSE_FLOOR) {
          report.banks[entry.bankId] = {
            status: "sanity-rejected",
            sources: sourceUrls,
            message: `catalog collapsed: scraped ${newCount} offers vs ${currentCount} stored (likely a broken scrape); kept existing rows. Re-run with SANITY_OVERRIDE=${entry.bankId} to accept.`,
            ...(result.assetFailures.length > 0 ? { assetFailures: result.assetFailures } : {}),
          };
          continue;
        }
        ({ seed, catalog } = importBankOffers(entry, dedupedOffers, reviewDateIso, seed, catalog));
        state.banks[entry.bankId] = { lastUpdatedAt: reviewDateIso, details: result.detailHashes };
        report.banks[entry.bankId] = {
          status: "updated", sources: sourceUrls, offersWritten: newCount,
          ...(result.assetFailures.length > 0 ? { assetFailures: result.assetFailures } : {}),
        };
        continue;
      }

      // Gate 1: fetch + strip every source. A source that fails is recorded but does not discard its
      // siblings — only when EVERY source in the bank fails do we keep existing rows and flag the bank.
      const fetched: { source: RegistrySource; result: FetchResult }[] = [];
      const assetFailures: { url: string; reason: string }[] = [];
      for (const source of entry.sources) {
        const result = await fetchAndStrip(source);
        if (!result.ok) {
          assetFailures.push({ url: source.url, reason: result.error ?? "unknown" });
          continue;
        }
        fetched.push({ source, result });
      }
      if (fetched.length === 0) {
        report.banks[entry.bankId] = {
          status: "fetch-failed",
          sources: sourceUrls,
          message: `fetch failed for all sources: ${assetFailures.map(f => `${f.url} (${f.reason})`).join("; ")}`,
        };
        continue;
      }

      // Gate 2: empty / too-short content keeps existing rows and flags the bank (no tokens).
      const tooThin = fetched.some(({ source, result }) =>
        source.type === "pdf"
          ? !result.pdfBytes || result.pdfBytes.length === 0
          : source.type === "image"
            ? !result.imageBytes || result.imageBytes.length === 0
            : (result.strippedText ?? "").length < MIN_CONTENT_CHARS
      );
      if (tooThin) {
        report.banks[entry.bankId] = {
          status: "skipped-empty",
          sources: sourceUrls,
          message: "content empty or below minimum length (consider source type 'dynamic_page')",
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
        };
        continue;
      }

      // Gate 3: unchanged content hash means nothing to do (no tokens).
      const combinedHash = hashContent(fetched.map(f => f.result.contentHash ?? "").join("|"));
      if (state.banks[entry.bankId]?.hash === combinedHash) {
        report.banks[entry.bankId] = {
          status: "unchanged", sources: sourceUrls,
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
        };
        continue;
      }

      // Changed content -> produce offers. Banks with a deterministic feed mapper (structured JSON API)
      // skip Claude entirely (no key, no budget, no tokens); all others use the Claude extractor.
      const offers: ScannedOffer[] = [];
      const mapper = feedMappers[entry.bankId];
      if (mapper) {
        for (const { result } of fetched) {
          offers.push(...mapper(result.strippedText ?? "", entry, reviewDateIso));
        }
      } else {
        // Claude path needs an API key and respects the per-run budget cap. Keep rows + retry if unavailable.
        if (!client || extractedCount >= maxBanks) {
          report.banks[entry.bankId] = {
            status: "deferred",
            sources: sourceUrls,
            message: client ? "MAX_BANKS_PER_RUN reached" : "ANTHROPIC_API_KEY not set",
            ...(assetFailures.length > 0 ? { assetFailures } : {}),
          };
          continue;
        }
        for (const { source, result } of fetched) {
          const extracted = await extractOffers(
            {
              entry,
              sourceUrl: source.url,
              strippedText: result.strippedText,
              pdfBytes: result.pdfBytes,
              imageBytes: result.imageBytes,
              imageMediaType: result.imageMediaType,
            },
            client,
            reviewDateIso
          );
          report.tokensUsed.input += extracted.inputTokens;
          report.tokensUsed.output += extracted.outputTokens;
          offers.push(...extracted.offers);
        }
        extractedCount += 1;
      }

      const activeOffers = offers.filter(o => isActiveOffer(o.validUntil, reviewDateIso));
      // Empty extraction is treated as a failure (keep existing rows) rather than wiping the bank.
      if (activeOffers.length === 0) {
        report.banks[entry.bankId] = {
          status: "extract-failed",
          sources: sourceUrls,
          message: "extraction returned no active offers",
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
        };
        continue;
      }

      // Sanity gate: refuse to overwrite an established catalog with a suspiciously small set
      // (likely a broken scrape). Keep existing rows, do NOT advance the hash, and fail the run so
      // the operator is alerted. Accept a real drop by re-running with SANITY_OVERRIDE=<bankId>.
      const currentCount = countBankOffers(seed, entry);
      const dedupedOffers = dedupeById(activeOffers);
      const newCount = dedupedOffers.length;
      if (!sanityOverride.has(entry.bankId) && currentCount >= SANITY_MIN_BASELINE && newCount <= SANITY_COLLAPSE_FLOOR) {
        report.banks[entry.bankId] = {
          status: "sanity-rejected",
          sources: sourceUrls,
          message: `catalog collapsed: scraped ${newCount} offers vs ${currentCount} stored (likely a broken scrape); kept existing rows. Re-run with SANITY_OVERRIDE=${entry.bankId} to accept.`,
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
        };
        continue;
      }

      ({ seed, catalog } = importBankOffers(entry, dedupedOffers, reviewDateIso, seed, catalog));
      state.banks[entry.bankId] = { hash: combinedHash, lastUpdatedAt: reviewDateIso };
      report.banks[entry.bankId] = {
        status: "updated", sources: sourceUrls, offersWritten: newCount,
        ...(assetFailures.length > 0 ? { assetFailures } : {}),
      };
    } catch (error) {
      report.banks[entry.bankId] = {
        status: "extract-failed",
        sources: sourceUrls,
        message: error instanceof Error ? error.message : "unknown error"
      };
    }
  }

  // Prune banks removed from the registry entirely, then drop globally-lapsed offers.
  const validBankIds = new Set(bankRegistry.filter(e => e.enabled).map(e => e.bankId));
  ({ seed, catalog } = reconcileOrphans(validBankIds, seed, catalog));
  const swept = expireLapsedOffers(reviewDateIso, seed, catalog);
  seed = swept.seed;
  catalog = swept.catalog;

  state.lastRunAt = reviewDateIso;
  writeJson(seedPath, seed);
  writeJson(scannedPath, catalog);
  writeJson(statePath, state);
  writeJson(reportPath, report);

  const counts = summarize(report);
  console.log(`Refresh complete. ${JSON.stringify(counts)} | expired swept: ${swept.dropped} | tokens: ${JSON.stringify(report.tokensUsed)}`);

  // Surface failures so the CI run is marked failed (and the operator is notified). A sanity-rejected
  // bank counts as a failure on purpose, so a rejected update never passes silently.
  const failures = (counts["fetch-failed"] ?? 0) + (counts["extract-failed"] ?? 0) + (counts["sanity-rejected"] ?? 0);
  if (failures > 0) {
    console.error(`${failures} bank(s) failed — see data/refresh-report.json`);
    if (counts["sanity-rejected"]) {
      console.error(`${counts["sanity-rejected"]} bank(s) sanity-rejected (big offer-count drop). Verify, then re-run with SANITY_OVERRIDE=<bankId> to accept.`);
    }
    process.exitCode = 1;
  }
}

// Counts a bank's current offers in the seed. Includes both registry card ids and any seed cards
// still attributed to the bank (so a card renamed/removed from the registry doesn't undercount the baseline).
function countBankOffers(seed: SeedData, entry: BankRegistryEntry): number {
  const cardIds = new Set([
    ...entry.cards.map(c => c.id),
    ...seed.cards.filter(c => c.bankId === entry.bankId).map(c => c.id)
  ]);
  return seed.offers.filter(o => cardIds.has(o.cardId)).length;
}

// Removes duplicate offers by id (last write wins).
function dedupeById(offers: ScannedOffer[]): ScannedOffer[] {
  const byId = new Map<string, ScannedOffer>();
  for (const offer of offers) byId.set(offer.id, offer);
  return [...byId.values()];
}

// Counts banks by status for the run summary.
function summarize(report: RefreshReport): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { status } of Object.values(report.banks)) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
