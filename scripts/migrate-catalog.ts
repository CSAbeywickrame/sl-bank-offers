import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { enrichOffer } from "@/lib/ingest/enrich";
import { assertScannedOfferCatalog, syncScannedOffers } from "@/lib/offers/scanned";
import {
  cardKinds,
  cardNetworks,
  cardTierValues,
  offerCategories,
  offerTypes,
  weekdays,
  type CardKind,
  type CardNetwork,
  type CardTier,
  type OfferCategory,
  type OfferType,
  type ScannedOffer,
  type ScannedOfferCatalog,
  type SeedData,
  type Weekday
} from "@/lib/offers/types";

/**
 * One-shot LLM catalog migration onto the vertical/mechanic taxonomy.
 *
 * Rewrites every offer's `category` from the flat 9-value enum (where installment/cashback/bogo
 * are payout mechanics, not merchant verticals) onto the 13 target verticals, moves the mechanic
 * into `offerType`, and backfills the structured enrichment fields. The model's value wins where
 * present; lib/ingest/enrich.ts regexes fill the gaps; nothing is invented by either source.
 *
 * Deliberately NOT the pinned Haiku EXTRACTION_MODEL: that model is tuned for the weekly refresh
 * where per-run cost compounds. This is a one-time pass whose output defines the site's taxonomy
 * permanently, so the better model is worth the roughly-a-dollar it costs.
 *
 * Operational contract:
 * - Resumable: model results checkpoint to data/migration-state.json after every batch, so a
 *   crash resumes where it stopped instead of re-spending the whole run. Delete the state file
 *   to force a full re-classification.
 * - Idempotent: re-running with a complete state file re-derives the same catalog without any
 *   API calls.
 * - Never corrupts the catalog: data files are written only after the full pass, and only after
 *   the rebuilt catalog passes assertScannedOfferCatalog and the row-count invariant.
 * - Scoped runs: ONLY_BANKS=hnb,ntb migrates just those banks' rows and leaves every other row
 *   byte-identical.
 */

const MIGRATION_MODEL = "claude-sonnet-5";
const dataDir = join(process.cwd(), "data");
const seedPath = join(dataDir, "seed.json");
const scannedPath = join(dataDir, "scanned-offers.json");
const migrationStatePath = join(dataDir, "migration-state.json");
const migrationReportPath = join(dataDir, "migration-report.json");

// The mechanics leaving the category enum. Rows carrying one MUST be reassigned to a vertical.
const mechanicCategories = ["installment", "cashback", "bogo"] as const;

// The 13 target verticals: the schema superset minus the outgoing mechanics. Derived rather than
// listed so this script can never drift from lib/offers/types.ts.
const targetCategories = offerCategories.filter(
  (category): category is OfferCategory => !(mechanicCategories as readonly string[]).includes(category)
);

// What the model returns per offer, post-sanitisation. Only fields it asserted survive.
interface ModelRow {
  category: OfferCategory;
  offerType: OfferType;
  discountPct?: number;
  discountLabel?: string;
  minSpend?: number;
  maxDiscountAmount?: number;
  validDays?: Weekday[];
  cardNetworks?: CardNetwork[];
  cardTypes?: CardKind[];
  cardTiers?: CardTier[];
  eligibilityNote?: string;
}

interface MigrationState {
  startedAt: string;
  model: string;
  // Sanitised model results keyed by offer id. The checkpoint AND the idempotency record: an id
  // present here is never sent to the model again.
  results: Record<string, ModelRow>;
}

// Structured-output schema. Structured outputs require additionalProperties:false on every
// object; optional fields are simply omitted from `required`.
const MIGRATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["offers"],
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "offerType"],
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: [...targetCategories] },
          offerType: { type: "string", enum: [...offerTypes] },
          discountPct: { type: "number" },
          discountLabel: { type: "string" },
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
  "You are migrating a catalog of Sri Lankan bank card offers onto a new taxonomy. For each offer you receive (id, title, merchant, description, location) return one classification entry with the same id.",
  "",
  "## category — WHAT is being bought (the merchant's vertical). NEVER how the offer is paid for or discounted.",
  "A 24-month 0% installment plan at an electronics store is category: electronics, offerType: installment. A cashback offer at a supermarket is category: supermarket, offerType: cashback. The payout mechanic must never leak into the category.",
  "- dining: restaurants, cafes, coffee shops, bars, pubs, bakeries, dessert/ice-cream shops, food delivery, buffets and dining packages. A restaurant INSIDE a hotel is dining, not hotels.",
  "- hotels: hotel and resort STAYS - room bookings, villa rentals, full/half-board packages, day outings at hotels and resorts, both local and overseas.",
  "- travel: flights, airlines, travel agents, tour packages, cruises, visas, airport lounges and services, foreign-currency/travel cards, duty free. Getting there; hotels is staying there.",
  "- supermarket: supermarkets, grocery stores and their delivery arms (Keells, Cargills, Arpico, Spar, Glomark...).",
  "- fuel: fuel stations and fuel purchases.",
  "- fashion: clothing, footwear, handbags, accessories, jewellery, watches, textiles, tailoring, department-store fashion.",
  "- electronics: phones, computers, appliances, TVs, cameras, electronics and mobile retailers.",
  "- health: hospitals, clinics, pharmacies, laboratories, dental, opticians and eyewear, spas, salons, gyms, wellness and personal care.",
  "- home: furniture, homeware, kitchenware, bedding, lighting, hardware, paint, tiles, bathware, curtains, home improvement and construction materials.",
  "- automotive: vehicle purchase and servicing, spare parts, tyres, batteries, lubricants, car care.",
  "- leisure: cinemas, amusement/water parks, gaming, events and shows, sports gear, toys, books and stationery, kids' activities, recreation.",
  "- online: online-only offers on multi-vertical e-commerce marketplaces or app platforms (Daraz, PickMe, Uber...). If the merchant sells ONE vertical, use that vertical even when the offer is online-only (an online fashion store is fashion; supermarket delivery is supermarket).",
  "- other: ONLY when nothing above fits: insurance, telecom, utilities, education, courier, banking services, gift vouchers with no vertical. Most offers ARE classifiable - be reluctant to use other.",
  "",
  "## offerType — HOW the offer pays out.",
  "- discount: a percentage or amount off, special price, or free upgrade.",
  "- installment: 0%-interest or easy-payment installment plans. An offer whose substance is the payment plan is installment even when a small discount is also mentioned; an offer whose headline is a discount that merely CAN be paid in installments is discount.",
  "- cashback: money credited back after the purchase.",
  "- bogo: buy-one-get-one or a free item with purchase.",
  "- other: none of the above (fee waivers, bonus points, free gifts).",
  "",
  "## Optional fields — set ONLY what the text explicitly states. Omit anything not stated. NEVER guess or infer.",
  "- discountPct: the headline discount percentage, above 0 and at most 100 (for 'up to X%' use X). NEVER a financing/interest rate - 0% interest is not a discount.",
  "- discountLabel: a short verbatim deal label ONLY when a bare percentage cannot describe the deal ('Buy 1 Get 1 Free', 'Rs. 2,000 off', 'Room upgrade free'). Omit when discountPct already says it.",
  "- minSpend: minimum qualifying spend in LKR.",
  "- maxDiscountAmount: cap on the saving in LKR (not transaction ceilings).",
  "- validDays: ONLY when the offer names specific days ('weekends' = sat,sun; 'weekdays' = mon-fri). Omit for everyday offers.",
  "- cardNetworks / cardTypes / cardTiers: ONLY when the text names them ('Visa Infinite' = networks [visa], tiers [infinite]; 'credit and debit cards' = types [credit, debit]).",
  "- eligibilityNote: a short verbatim quote of a real eligibility restriction ('Exclusively for Visa Infinite cardholders'). Omit when the offer is open to all cardholders.",
  "",
  "Return exactly one entry per input offer, each input id exactly once, ids copied verbatim."
].join("\n");

// ---------------------------------------------------------------------------
// Small IO + env helpers (house style: scripts/refresh.ts)
// ---------------------------------------------------------------------------

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Model-response sanitisation. Structured output enforces the JSON shape, but every VALUE is
// still re-checked here: an id must belong to the batch, enums must be schema members, amounts
// must be positive. A field that fails simply drops - the regex enrichment or absence covers it.
// ---------------------------------------------------------------------------

interface RawModelRow {
  id?: unknown;
  category?: unknown;
  offerType?: unknown;
  discountPct?: unknown;
  discountLabel?: unknown;
  minSpend?: unknown;
  maxDiscountAmount?: unknown;
  validDays?: unknown;
  cardNetworks?: unknown;
  cardTypes?: unknown;
  cardTiers?: unknown;
  eligibilityNote?: unknown;
}

function toMember<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

// Valid members only, deduped, in schema order. Undefined when nothing (or everything invalid) remains.
function toMemberArray<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const members = new Set(value.map((entry) => toMember(entry, allowed)).filter((entry): entry is T => entry !== undefined));
  const ordered = allowed.filter((entry) => members.has(entry));
  return ordered.length > 0 ? ordered : undefined;
}

function toPositiveAmount(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max) return undefined;
  return Math.round(value * 100) / 100;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Mirrors setWhenParsed in enrich.ts: assign only when the value resolved, so dropped fields stay
// absent instead of becoming explicit undefined keys (which would serialize differently).
function setWhenValid<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

// Sanitises one raw model row into a ModelRow, or undefined when the row is unusable
// (unknown/duplicate id, or a category/offerType outside the schema).
function sanitizeModelRow(raw: RawModelRow, batchIds: Set<string>): { id: string; row: ModelRow } | undefined {
  const id = typeof raw.id === "string" ? raw.id : undefined;
  if (!id || !batchIds.has(id)) return undefined;

  const category = toMember(raw.category, targetCategories);
  const offerType = toMember(raw.offerType, offerTypes);
  if (!category || !offerType) return undefined;

  const row: ModelRow = { category, offerType };
  setWhenValid(row, "discountPct", toPositiveAmount(raw.discountPct, 100));
  setWhenValid(row, "discountLabel", toTrimmedString(raw.discountLabel));
  setWhenValid(row, "minSpend", toPositiveAmount(raw.minSpend, Number.POSITIVE_INFINITY));
  setWhenValid(row, "maxDiscountAmount", toPositiveAmount(raw.maxDiscountAmount, Number.POSITIVE_INFINITY));
  // All seven days is not a restriction - same convention as parseValidDays in enrich.ts.
  const validDays = toMemberArray(raw.validDays, weekdays);
  setWhenValid(row, "validDays", validDays && validDays.length < weekdays.length ? validDays : undefined);
  setWhenValid(row, "cardNetworks", toMemberArray(raw.cardNetworks, cardNetworks));
  setWhenValid(row, "cardTypes", toMemberArray(raw.cardTypes, cardKinds));
  setWhenValid(row, "cardTiers", toMemberArray(raw.cardTiers, cardTierValues));
  setWhenValid(row, "eligibilityNote", toTrimmedString(raw.eligibilityNote));
  return { id, row };
}

// ---------------------------------------------------------------------------
// One classification call over a batch of offers.
// ---------------------------------------------------------------------------

interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function readResponseText(message: Anthropic.Message): string {
  const textBlock = message.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  return textBlock?.text ?? "";
}

async function classifyBatch(
  client: Anthropic,
  offers: ScannedOffer[],
  usage: TokenUsage
): Promise<Map<string, ModelRow>> {
  // Only the fields the model needs; omitted keys keep the payload lean.
  const payload = offers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    ...(offer.merchant ? { merchant: offer.merchant } : {}),
    description: offer.description,
    ...(offer.location ? { location: offer.location } : {})
  }));

  // Stream with a high cap: 40 classified rows plus thinking is well under it, but >16K output
  // would require streaming anyway and output is billed per actual token, so the cap is free.
  const stream = client.messages.stream({
    model: MIGRATION_MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: MIGRATION_SCHEMA } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [{ type: "text", text: `Classify these ${offers.length} offers:\n${JSON.stringify(payload)}` }] }]
  });
  const message = await stream.finalMessage();

  usage.input += message.usage.input_tokens ?? 0;
  usage.output += message.usage.output_tokens ?? 0;
  usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
  usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

  // A truncated response yields invalid JSON; fail loudly so the batch retries.
  if (message.stop_reason === "max_tokens") {
    throw new Error(`classification truncated at max_tokens for a ${offers.length}-offer batch`);
  }

  const parsed = JSON.parse(readResponseText(message) || "{}") as { offers?: RawModelRow[] };
  const rawRows = Array.isArray(parsed.offers) ? parsed.offers : [];

  const batchIds = new Set(offers.map((offer) => offer.id));
  const rows = new Map<string, ModelRow>();
  for (const raw of rawRows) {
    const sanitized = sanitizeModelRow(raw, batchIds);
    // First occurrence wins on a duplicated id; ids the model missed stay pending and re-run.
    if (sanitized && !rows.has(sanitized.id)) {
      rows.set(sanitized.id, sanitized.row);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Merge: model result -> offer, then regex enrichment fills what the model omitted, then the
// one-time firstSeenAt backfill. Rows without a model result (persistent batch failure) keep
// their existing category but still get the enrichment + firstSeenAt passes, which are
// deterministic and text-derived.
// ---------------------------------------------------------------------------

function migrateOffer(offer: ScannedOffer, model: ModelRow | undefined): ScannedOffer {
  const withModel: ScannedOffer = { ...offer };
  if (model) {
    withModel.category = model.category;
    // The model's value wins where present; enrichOffer below only fills blanks.
    setWhenValid(withModel, "offerType", model.offerType);
    setWhenValid(withModel, "discountPct", model.discountPct);
    setWhenValid(withModel, "discountLabel", model.discountLabel);
    setWhenValid(withModel, "minSpend", model.minSpend);
    setWhenValid(withModel, "maxDiscountAmount", model.maxDiscountAmount);
    setWhenValid(withModel, "validDays", model.validDays);
    setWhenValid(withModel, "cardNetworks", model.cardNetworks);
    setWhenValid(withModel, "cardTypes", model.cardTypes);
    setWhenValid(withModel, "cardTiers", model.cardTiers);
    setWhenValid(withModel, "eligibilityNote", model.eligibilityNote);
  }

  const enriched = enrichOffer(withModel);
  // The only moment this backfill is possible: lastReviewedAt is rewritten every refresh, so
  // seeding it as the "date added" floor has to happen before the next refresh overwrites it.
  // Never clobbers a real firstSeenAt on a re-run.
  enriched.firstSeenAt = enriched.firstSeenAt ?? enriched.lastReviewedAt;
  return enriched;
}

// ---------------------------------------------------------------------------
// Distribution report
// ---------------------------------------------------------------------------

const enrichmentFillFields = [
  "offerType",
  "discountPct",
  "discountLabel",
  "minSpend",
  "maxDiscountAmount",
  "validDays",
  "cardNetworks",
  "cardTypes",
  "cardTiers",
  "eligibilityNote",
  "firstSeenAt"
] as const;

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildReport(before: ScannedOffer[], after: ScannedOffer[], unmigratedIds: string[]) {
  const beforeById = new Map(before.map((offer) => [offer.id, offer]));
  const fillRates: Record<string, number> = {};
  for (const field of enrichmentFillFields) {
    fillRates[field] = after.filter((offer) => offer[field] !== undefined).length;
  }

  // 50 random rows so misclassification is visible rather than asserted.
  const shuffled = [...after].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, 50).map((offer) => {
    const old = beforeById.get(offer.id);
    return `${offer.title} -> ${old?.category ?? "?"} => ${offer.category} / ${offer.offerType ?? "-"} / ${offer.discountPct ?? "-"}`;
  });

  return {
    generatedAt: new Date().toISOString(),
    model: MIGRATION_MODEL,
    totalOffers: after.length,
    categoryBefore: countBy(before, (offer) => offer.category),
    categoryAfter: countBy(after, (offer) => offer.category),
    offerTypeBefore: countBy(before, (offer) => offer.offerType ?? "(absent)"),
    offerTypeAfter: countBy(after, (offer) => offer.offerType ?? "(absent)"),
    fillRates,
    unmigratedIds,
    sample
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const runDateIso = new Date().toISOString();
  const onlyBanks = new Set((process.env.ONLY_BANKS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const batchSize = envNumber("MIGRATE_BATCH_SIZE", 40);
  const concurrency = envNumber("MIGRATE_CONCURRENCY", 3);
  // Rounds: a failed or partially-answered batch gets its pending ids re-chunked and re-sent.
  const maxRounds = envNumber("MIGRATE_MAX_ROUNDS", 3);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (run via: npm run migrate:catalog)");
  }
  const client = new Anthropic();

  const catalog = readJson<ScannedOfferCatalog | null>(scannedPath, null);
  const seed = readJson<SeedData | null>(seedPath, null);
  if (!catalog || !seed) {
    throw new Error("data/scanned-offers.json and data/seed.json must both exist");
  }

  const inputCount = catalog.offers.length;
  const inScope = (offer: ScannedOffer): boolean => onlyBanks.size === 0 || onlyBanks.has(offer.bankId);
  const scopedOffers = catalog.offers.filter(inScope);
  console.log(
    `Migrating ${scopedOffers.length}/${inputCount} offers` +
      `${onlyBanks.size > 0 ? ` (ONLY_BANKS=${[...onlyBanks].join(",")})` : ""} ` +
      `with ${MIGRATION_MODEL}, batch size ${batchSize}, concurrency ${concurrency}`
  );

  const state = readJson<MigrationState>(migrationStatePath, { startedAt: runDateIso, model: MIGRATION_MODEL, results: {} });
  const alreadyDone = scopedOffers.filter((offer) => state.results[offer.id]).length;
  if (alreadyDone > 0) {
    console.log(`Resuming: ${alreadyDone} offers already classified in data/migration-state.json`);
  }

  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const failedBatches: { round: number; batch: number; size: number; error: string }[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const pending = scopedOffers.filter((offer) => !state.results[offer.id]);
    if (pending.length === 0) break;
    if (round > 1) {
      console.log(`Round ${round}: retrying ${pending.length} pending offers`);
    }

    const batches = chunk(pending, batchSize);
    let completed = 0;
    let cursor = 0;

    // Small worker pool: batches are independent, and Node's single thread makes the shared
    // state/counter mutations below race-free.
    const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
      while (cursor < batches.length) {
        const batchIndex = cursor++;
        const batch = batches[batchIndex];
        try {
          const rows = await classifyBatch(client, batch, usage);
          for (const [id, row] of rows) {
            state.results[id] = row;
          }
          // Checkpoint after every batch so a crash costs at most one batch.
          writeJson(migrationStatePath, state);
          completed += 1;
          console.log(
            `[round ${round} | batch ${completed}/${batches.length}] ${rows.size}/${batch.length} rows | ` +
              `tokens in ${usage.input} out ${usage.output} (cache read ${usage.cacheRead}, write ${usage.cacheWrite})`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failedBatches.push({ round, batch: batchIndex + 1, size: batch.length, error: message });
          console.error(`[round ${round} | batch ${batchIndex + 1}/${batches.length}] FAILED: ${message}`);
        }
      }
    });
    await Promise.all(workers);
  }

  const unmigratedIds = scopedOffers.filter((offer) => !state.results[offer.id]).map((offer) => offer.id);
  if (unmigratedIds.length > 0) {
    console.warn(`${unmigratedIds.length} offers kept their existing category after ${maxRounds} rounds; see report.`);
  }

  // Full rebuild in memory; out-of-scope rows pass through untouched.
  const migratedOffers = catalog.offers.map((offer) => (inScope(offer) ? migrateOffer(offer, state.results[offer.id]) : offer));

  // Row-count invariant: the migration must not drop or duplicate rows.
  if (migratedOffers.length !== inputCount) {
    throw new Error(`row count changed: ${inputCount} -> ${migratedOffers.length}; aborting without writing`);
  }
  // Every row the model classified must have left the mechanic categories. (Rows the model never
  // answered keep theirs by design and are surfaced above rather than guessed.)
  const stuckMechanics = migratedOffers.filter(
    (offer) => (mechanicCategories as readonly string[]).includes(offer.category) && state.results[offer.id]
  );
  if (stuckMechanics.length > 0) {
    throw new Error(`${stuckMechanics.length} classified rows still carry a mechanic category; aborting without writing`);
  }

  const nextCatalog: ScannedOfferCatalog = { ...catalog, updatedAt: runDateIso, offers: migratedOffers };
  // Validate the ENTIRE rebuilt catalog before any file is touched.
  assertScannedOfferCatalog(nextCatalog);
  const nextSeed = syncScannedOffers(seed, nextCatalog);

  writeJson(scannedPath, nextCatalog);
  writeJson(seedPath, nextSeed);

  const report = buildReport(catalog.offers, migratedOffers, unmigratedIds);
  writeJson(migrationReportPath, report);

  console.log("\n=== Migration report ===");
  console.log(`category before: ${JSON.stringify(report.categoryBefore)}`);
  console.log(`category after:  ${JSON.stringify(report.categoryAfter)}`);
  console.log(`offerType after: ${JSON.stringify(report.offerTypeAfter)}`);
  console.log(`fill rates: ${JSON.stringify(report.fillRates)}`);
  console.log(`unmigrated in scope: ${unmigratedIds.length} | failed batches: ${failedBatches.length}`);
  for (const failure of failedBatches) {
    console.log(`  failed: round ${failure.round} batch ${failure.batch} (${failure.size} offers): ${failure.error}`);
  }

  // Catalog-wide completion, reported separately from the in-scope numbers above. A scoped run over
  // already-finished banks otherwise prints "unmigrated: 0" and reads as a finished migration while
  // most of the catalog is still untouched — which is exactly how a 572-offer shortfall was missed.
  const catalogUnclassified = migratedOffers.filter((offer) => !state.results[offer.id]);
  if (catalogUnclassified.length > 0) {
    const byBank = new Map<string, number>();
    for (const offer of catalogUnclassified) byBank.set(offer.bankId, (byBank.get(offer.bankId) ?? 0) + 1);
    const breakdown = [...byBank.entries()].sort((a, b) => b[1] - a[1]).map(([bank, n]) => `${bank}=${n}`).join(" ");
    const stillMechanic = catalogUnclassified.filter((offer) =>
      (mechanicCategories as readonly string[]).includes(offer.category)
    ).length;
    console.log(
      `\nMIGRATION INCOMPLETE: ${catalogUnclassified.length}/${migratedOffers.length} offers across the catalog are still unclassified (${breakdown}).` +
        `\n${stillMechanic} of them still carry a mechanic as their category. Re-run with ONLY_BANKS set to those banks before shipping.`
    );
    process.exitCode = 1;
  } else {
    console.log(`\nMigration complete: all ${migratedOffers.length} offers classified.`);
  }
  console.log(`tokens: ${JSON.stringify(usage)}`);
  console.log(`Wrote ${migratedOffers.length} offers to data/scanned-offers.json + data/seed.json; report at data/migration-report.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
