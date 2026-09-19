import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { bankRegistry, type BankRegistryEntry, type RegistrySource } from "@/lib/sources/bankRegistry";
import { fetchAndStrip, hashContent, fetchRawHtml, stripHtml, type FetchResult } from "@/lib/ingest/fetchAndStrip";
import { refreshCrawlBank, discoverCrawlUrls, collectPageAssets, isUndersizedImage, groupOffersBySourceUrl, carryForwardUnextractedOffers, type CrawlExtractResult } from "@/lib/ingest/crawlExtract";
import { extractOffers } from "@/lib/ingest/extractWithClaude";
import { dedupeOffers, expireLapsedOffers, importBankOffers, isActiveOffer, reconcileOrphans, removeBank } from "@/lib/ingest/importBank";
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
  // Crawl-bank-only diagnostics (RC3/RC4): how many detail pages were freshly extracted vs. reused
  // from the prior run. Absent for feed/static-page banks.
  extracted?: number;
  reused?: number;
  // How many extraction attempts threw this run. Set by BOTH branches (crawlDiagnostics for crawl
  // banks, nonCrawlDiagnostics for the rest), unlike extracted/reused above.
  extractFailures?: number;
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

// Writes a value as pretty JSON with a trailing newline, atomically: written to a temp file in the
// same directory first, then renamed over the target. Rename is atomic on the same filesystem, so a
// process killed mid-write (e.g. an OOM kill) can never leave a torn/partial JSON file behind.
function writeJson(path: string, value: unknown): void {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmpPath, path);
}

// Extra diagnostic fields folded into a crawl bank's report row — present only when there's
// something to say for assetFailures/extractFailures, so a healthy bank's report entry stays as
// small as it was before.
function crawlDiagnostics(result: CrawlExtractResult): Pick<BankReport, "extracted" | "reused" | "assetFailures" | "extractFailures"> {
  return {
    extracted: result.extracted,
    reused: result.reused,
    ...(result.assetFailures.length > 0 ? { assetFailures: result.assetFailures } : {}),
    ...(result.extractFailures > 0 ? { extractFailures: result.extractFailures } : {}),
  };
}

// Extra diagnostic field folded into a non-crawl bank's report row when a Claude extraction threw
// this run — mirrors crawlDiagnostics so extractFailureTotal (in main()) counts both branches equally.
function nonCrawlDiagnostics(extractFailures: number): Pick<BankReport, "extractFailures"> {
  return extractFailures > 0 ? { extractFailures } : {};
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
  // Skip all auto-discovered image/PDF asset work (discovery re-scan + asset extraction) — perf isolation lever.
  const skipAssets = process.env.SKIP_ASSETS === "1";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // A stalled call must not block the whole run for the SDK's 10-minute default (RC8).
  const client = apiKey ? new Anthropic({ timeout: 180_000 }) : null;

  let seed = readJson<SeedData>(seedPath, { banks: [], cards: [], offers: [] });
  let catalog = readJson<ScannedOfferCatalog>(scannedPath, { version: 1, updatedAt: reviewDateIso, offers: [] });
  const state = readJson<RefreshState>(statePath, { lastRunAt: "", banks: {} });

  const report: RefreshReport = { runAt: reviewDateIso, tokensUsed: { input: 0, output: 0 }, banks: {} };
  let extractedCount = 0;

  // Persists seed/catalog/state/report to disk. Called after every bank — success, failure, or
  // disabled — not just once at the very end: a multi-hour run that dies partway (an OOM kill cost
  // us 40 minutes of real API spend and three completed banks once already) must not lose banks
  // that already finished. writeJson's atomic rename also means a kill mid-write leaves no torn file.
  const checkpoint = (): void => {
    writeJson(seedPath, seed);
    writeJson(scannedPath, catalog);
    writeJson(statePath, state);
    writeJson(reportPath, report);
  };

  for (const entry of bankRegistry) {
    if (onlyBanks.size > 0 && !onlyBanks.has(entry.bankId)) continue;
    const sourceUrls = entry.sources.map(s => s.url);

    // Retire disabled banks: remove their rows once, then skip.
    if (!entry.enabled) {
      ({ seed, catalog } = removeBank(entry, reviewDateIso, seed, catalog));
      report.banks[entry.bankId] = { status: "disabled", sources: sourceUrls };
      checkpoint();
      continue;
    }

    // Per-bank asset policy: global SKIP_ASSETS OR the bank opting out via scanAssets:false.
    const skipAssetsForBank = skipAssets || entry.scanAssets === false;

    // Progress output (RC4): a full run takes hours and used to print nothing until the very end.
    // console.error (not console.log) keeps stdout as the machine-readable summary line only.
    const bankStartedAt = Date.now();
    console.error(`[refresh] ${entry.bankId}: starting (${sourceUrls.length} source${sourceUrls.length === 1 ? "" : "s"})`);

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
          discover: () => discoverCrawlUrls(
            seedUrls,
            recipe,
            fetchRawHtml,
            entry.assetHosts ?? [],
            skipAssetsForBank,
            // Strips each discovered detail page's HTML during discovery itself (byte-identical
            // basis to fetchAndStrip's static_html path: hashContent(stripHtml(html))), so
            // refreshCrawlBank never needs a second fetch of the same URL — and only the ~7KB
            // stripped text is retained per page, not the ~240KB of raw HTML (RC7 OOM fix).
            (html) => {
              const strippedText = stripHtml(html);
              return { strippedText, contentHash: hashContent(strippedText) };
            },
          ),
          fetchDetail: async (url, type) => {
            const fetched = await fetchAndStrip({ url, type });
            if (fetched.ok && isUndersizedImage(type, fetched.imageBytes)) {
              return { ok: true };
            }
            return fetched;
          },
          extract: async (sourceUrl, fetched) => {
            const ex = await extractOffers({ entry, sourceUrl, ...fetched }, client, reviewDateIso);
            return { offers: ex.offers, inputTokens: ex.inputTokens, outputTokens: ex.outputTokens };
          },
          throttleMs: 300,
          maxExtractions: maxDetails,
          onProgress: (done, total, extracted, failed) => {
            if (done % 10 === 0 || done === total) {
              console.error(`[refresh] ${entry.bankId} ${done}/${total} pages · ${extracted} extracted · ${failed} failed`);
            }
          },
        });
        report.tokensUsed.input += result.inputTokens;
        report.tokensUsed.output += result.outputTokens;
        if (!result.ok) {
          report.banks[entry.bankId] = {
            status: "fetch-failed", sources: sourceUrls, message: result.error,
            ...crawlDiagnostics(result),
          };
          continue;
        }
        // Every attempted extraction failing (an RC1-style outage) must not look like a healthy
        // "updated" run just because keepPrior reused the bank's existing rows for each failed URL —
        // that's exactly how a 100%-failing extraction stayed invisible before (RC3).
        if (result.extractFailures > 0 && result.extracted === 0) {
          report.banks[entry.bankId] = {
            status: "extract-failed",
            sources: sourceUrls,
            message: `all ${result.extractFailures} extraction attempt(s) failed`,
            ...crawlDiagnostics(result),
          };
          continue;
        }
        const activeOffers = result.offers.filter((o) => isActiveOffer(o.validUntil, reviewDateIso));
        if (activeOffers.length === 0) {
          report.banks[entry.bankId] = {
            status: "extract-failed", sources: sourceUrls, message: "crawl returned no active offers",
            ...crawlDiagnostics(result),
          };
          continue;
        }
        const currentCount = countBankOffers(seed, entry);
        const dedupedOffers = dedupeOffers(activeOffers);
        const newCount = dedupedOffers.length;
        if (!sanityOverride.has(entry.bankId) && currentCount >= SANITY_MIN_BASELINE && newCount <= SANITY_COLLAPSE_FLOOR) {
          report.banks[entry.bankId] = {
            status: "sanity-rejected",
            sources: sourceUrls,
            message: `catalog collapsed: scraped ${newCount} offers vs ${currentCount} stored (likely a broken scrape); kept existing rows. Re-run with SANITY_OVERRIDE=${entry.bankId} to accept.`,
            ...crawlDiagnostics(result),
          };
          continue;
        }
        ({ seed, catalog } = importBankOffers(entry, dedupedOffers, reviewDateIso, seed, catalog));
        state.banks[entry.bankId] = { lastUpdatedAt: reviewDateIso, details: result.detailHashes };
        report.banks[entry.bankId] = {
          status: "updated", sources: sourceUrls, offersWritten: newCount,
          ...crawlDiagnostics(result),
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
      // Feed sources are exempt from the length check: MIN_CONTENT_CHARS is a heuristic for "an HTML
      // page failed to render", but fetchAndStrip already validates a feed payload parses as JSON, so a
      // short-but-valid response (e.g. a legitimately empty category like Sampath's "fuel") is real data,
      // not a failure. A total collapse across all sources is still caught downstream by the sanity gate.
      const tooThin = fetched.some(({ source, result }) =>
        source.type === "pdf"
          ? !result.pdfBytes || result.pdfBytes.length === 0
          : source.type === "image"
            ? !result.imageBytes || result.imageBytes.length === 0
            : source.type === "feed"
              ? false
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

      // Auto-discovered PDF/image assets on the fetched pages (banners/flyers embedded as <img>/<a href=.pdf>,
      // not explicit registry sources) — folded into the hash so an image swap alone re-triggers extraction.
      const pageAssets = skipAssetsForBank ? [] : collectPageAssets(
        fetched.filter((f) => f.result.rawHtml !== undefined).map((f) => ({ url: f.source.url, rawHtml: f.result.rawHtml! })),
        entry.assetHosts ?? [],
      );

      // Gate 3: unchanged content hash means nothing to do (no tokens).
      const combinedHash = hashContent(
        [...fetched.map(f => f.result.contentHash ?? ""), ...pageAssets.map(a => a.url).sort()].join("|")
      );
      if (state.banks[entry.bankId]?.hash === combinedHash) {
        report.banks[entry.bankId] = {
          status: "unchanged", sources: sourceUrls,
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
        };
        continue;
      }

      // Changed content -> produce offers. Banks with a deterministic feed mapper (structured JSON API)
      // skip Claude entirely (no key, no budget, no tokens); all others use the Claude extractor.
      let offers: ScannedOffer[] = [];
      let nonCrawlExtracted = 0; // successful Claude extractions this run, across page-text sources + auto-discovered assets
      let extractFailures = 0; // extractOffers() throws this run, across both loops
      const mapper = feedMappers[entry.bankId];
      if (mapper) {
        for (const { result } of fetched) {
          offers.push(...mapper(result.strippedText ?? "", entry, reviewDateIso));
        }
        // The same promo can appear under several category tabs (e.g. a Sampath offer listed under both
        // "hotels" and "premium_offers"); dedup by id, keeping the first occurrence, so a multi-source
        // feed bank never produces duplicate rows for one promo.
        const seenIds = new Set<string>();
        offers = offers.filter((offer) => {
          if (seenIds.has(offer.id)) return false;
          seenIds.add(offer.id);
          return true;
        });
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

        // A bank's prior offers grouped by their source URL, keyed the same way refreshCrawlBank keys its
        // own reuse map — used below to carry forward any asset/page whose extraction this run didn't
        // succeed, so a partial run never silently wipes that source's rows on the wholesale replace.
        const priorOffersByUrl = groupOffersBySourceUrl(catalog.offers.filter((o) => o.bankId === entry.bankId));
        // Carries a URL's prior offers into `offers` — the single call site used by every "not
        // extracted this run" case below (cap reached, fetch failed, undersized image, extract threw).
        const carryForward = (urls: string[]): void => {
          offers.push(...carryForwardUnextractedOffers(priorOffersByUrl, urls));
        };

        // Some banks (e.g. cargills-bank) have no usable listing-page text — skip this Claude call
        // entirely and rely on the auto-discovered asset loop below.
        if (entry.extractPageText !== false) {
          for (const { source, result } of fetched) {
            // A throw on one listing page must not drop a multi-source bank's other sources (dfcc/union-bank).
            let extracted;
            try {
              extracted = await extractOffers(
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
            } catch (error) {
              assetFailures.push({ url: source.url, reason: error instanceof Error ? error.message : "extract failed" });
              extractFailures += 1;
              carryForward([source.url]);
              continue;
            }
            report.tokensUsed.input += extracted.inputTokens;
            report.tokensUsed.output += extracted.outputTokens;
            offers.push(...extracted.offers);
            nonCrawlExtracted += 1;
          }
          extractedCount += 1;
        }

        // Auto-discovered assets (banner images/PDFs found while scanning the page, not explicit registry
        // sources): run each through Claude too, capped by the same per-run detail budget as crawl banks.
        let assetExtractions = 0;
        for (const [i, asset] of pageAssets.entries()) {
          if (assetExtractions >= maxDetails) {
            // Cap reached: carry forward this AND every remaining asset's prior offers instead of silently
            // dropping them — previously this just broke out of the loop and forgot them (data-loss bug).
            carryForward(pageAssets.slice(i).map((a) => a.url));
            break;
          }
          const assetResult = await fetchAndStrip({ url: asset.url, type: asset.type });
          if (!assetResult.ok) {
            assetFailures.push({ url: asset.url, reason: assetResult.error ?? "unknown" });
            carryForward([asset.url]);
            continue;
          }
          if (isUndersizedImage(asset.type, assetResult.imageBytes)) {
            // A deliberate skip, not a failure. Usually this is a brand-new icon with no prior offers to carry
            // forward — but an image that DID have real prior offers can also come back undersized on a later
            // fetch (truncated/short-served), so carrying it forward the same way as the other "not extracted"
            // cases here is what prevents that from reading as a real disappearance, not just a no-op.
            carryForward([asset.url]);
            continue;
          }
          // A single bad flyer (e.g. a corrupt/oversized image Claude rejects) must not abort the bank.
          let extracted;
          try {
            extracted = await extractOffers(
              {
                entry,
                sourceUrl: asset.url,
                strippedText: assetResult.strippedText,
                pdfBytes: assetResult.pdfBytes,
                imageBytes: assetResult.imageBytes,
                imageMediaType: assetResult.imageMediaType,
              },
              client,
              reviewDateIso
            );
          } catch (error) {
            assetFailures.push({ url: asset.url, reason: error instanceof Error ? error.message : "extract failed" });
            extractFailures += 1;
            carryForward([asset.url]);
            continue;
          }
          report.tokensUsed.input += extracted.inputTokens;
          report.tokensUsed.output += extracted.outputTokens;
          offers.push(...extracted.offers);
          assetExtractions += 1;
          nonCrawlExtracted += 1;
        }
      }

      // Every attempted extraction failing (RC3, non-crawl side) must not read as a healthy "updated" run
      // just because carried-forward prior offers padded `offers` back up — mirrors the crawl branch's
      // identical check on result.extractFailures / result.extracted.
      if (extractFailures > 0 && nonCrawlExtracted === 0) {
        report.banks[entry.bankId] = {
          status: "extract-failed",
          sources: sourceUrls,
          message: `all ${extractFailures} extraction attempt(s) failed`,
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
          ...nonCrawlDiagnostics(extractFailures),
        };
        continue;
      }

      const activeOffers = offers.filter(o => isActiveOffer(o.validUntil, reviewDateIso));
      // Empty extraction is treated as a failure (keep existing rows) rather than wiping the bank.
      if (activeOffers.length === 0) {
        report.banks[entry.bankId] = {
          status: "extract-failed",
          sources: sourceUrls,
          message: "extraction returned no active offers",
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
          ...nonCrawlDiagnostics(extractFailures),
        };
        continue;
      }

      // Sanity gate: refuse to overwrite an established catalog with a suspiciously small set
      // (likely a broken scrape). Keep existing rows, do NOT advance the hash, and fail the run so
      // the operator is alerted. Accept a real drop by re-running with SANITY_OVERRIDE=<bankId>.
      const currentCount = countBankOffers(seed, entry);
      const dedupedOffers = dedupeOffers(activeOffers);
      const newCount = dedupedOffers.length;
      if (!sanityOverride.has(entry.bankId) && currentCount >= SANITY_MIN_BASELINE && newCount <= SANITY_COLLAPSE_FLOOR) {
        report.banks[entry.bankId] = {
          status: "sanity-rejected",
          sources: sourceUrls,
          message: `catalog collapsed: scraped ${newCount} offers vs ${currentCount} stored (likely a broken scrape); kept existing rows. Re-run with SANITY_OVERRIDE=${entry.bankId} to accept.`,
          ...(assetFailures.length > 0 ? { assetFailures } : {}),
          ...nonCrawlDiagnostics(extractFailures),
        };
        continue;
      }

      ({ seed, catalog } = importBankOffers(entry, dedupedOffers, reviewDateIso, seed, catalog));
      state.banks[entry.bankId] = { hash: combinedHash, lastUpdatedAt: reviewDateIso };
      report.banks[entry.bankId] = {
        status: "updated", sources: sourceUrls, offersWritten: newCount,
        ...(assetFailures.length > 0 ? { assetFailures } : {}),
        ...nonCrawlDiagnostics(extractFailures),
      };
    } catch (error) {
      report.banks[entry.bankId] = {
        status: "extract-failed",
        sources: sourceUrls,
        message: error instanceof Error ? error.message : "unknown error"
      };
    } finally {
      const elapsedSec = ((Date.now() - bankStartedAt) / 1000).toFixed(1);
      const b = report.banks[entry.bankId];
      if (b) {
        const parts = [`${b.status} in ${elapsedSec}s`];
        if (b.offersWritten !== undefined) parts.push(`${b.offersWritten} offers written`);
        if (b.extracted !== undefined) parts.push(`${b.extracted} extracted`);
        if (b.reused !== undefined) parts.push(`${b.reused} reused`);
        if (b.assetFailures?.length) parts.push(`${b.assetFailures.length} asset failure(s)`);
        if (b.extractFailures) parts.push(`${b.extractFailures} extract failure(s)`);
        console.error(`[refresh] ${entry.bankId}: ${parts.join(" · ")}`);
      }
      checkpoint();
    }
  }

  // Prune banks removed from the registry entirely, then drop globally-lapsed offers.
  const validBankIds = new Set(bankRegistry.filter(e => e.enabled).map(e => e.bankId));
  ({ seed, catalog } = reconcileOrphans(validBankIds, seed, catalog));
  const swept = expireLapsedOffers(reviewDateIso, seed, catalog);
  seed = swept.seed;
  catalog = swept.catalog;

  state.lastRunAt = reviewDateIso;
  checkpoint();

  const counts = summarize(report);
  // Sums extractFailures across ALL banks regardless of final status — a bank can have some
  // extractions fail and still end up "updated" if enough other pages succeeded, so this can't be
  // read off the bank-status counts alone (RC3).
  const extractFailureTotal = Object.values(report.banks).reduce((sum, b) => sum + (b.extractFailures ?? 0), 0);
  const assetFailureTotal = Object.values(report.banks).reduce((sum, b) => sum + (b.assetFailures?.length ?? 0), 0);
  console.log(`Refresh complete. ${JSON.stringify(counts)} | expired swept: ${swept.dropped} | tokens: ${JSON.stringify(report.tokensUsed)} | assetFailures: ${assetFailureTotal} | extractFailures: ${extractFailureTotal}`);

  // Surface failures so the CI run is marked failed (and the operator is notified). A sanity-rejected
  // bank counts as a failure on purpose, so a rejected update never passes silently. extractFailureTotal
  // is checked independently of bank status: a partially-failing crawl bank can still end up "updated"
  // (see crawlDiagnostics), and that must still fail the run rather than passing silently (RC3).
  const failures = (counts["fetch-failed"] ?? 0) + (counts["extract-failed"] ?? 0) + (counts["sanity-rejected"] ?? 0);
  if (failures > 0 || extractFailureTotal > 0) {
    if (failures > 0) {
      console.error(`${failures} bank(s) failed — see data/refresh-report.json`);
    }
    if (extractFailureTotal > 0) {
      console.error(`${extractFailureTotal} extraction attempt(s) failed across the run (see per-bank extractFailures in data/refresh-report.json).`);
    }
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
