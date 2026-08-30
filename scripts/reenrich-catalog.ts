import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { enrichOffer } from "@/lib/ingest/enrich";
import { assertScannedOfferCatalog, syncScannedOffers } from "@/lib/offers/scanned";
import type { ScannedOfferCatalog, SeedData } from "@/lib/offers/types";

/**
 * Re-runs the regex enrichment over the stored catalog.
 *
 * enrichOffer only runs when a bank is imported, so a parser added to lib/ingest/enrich.ts reaches
 * existing rows no earlier than that bank's next refresh — and never for a row whose source page
 * has not changed. This backfills them now instead.
 *
 * Free and safe to re-run: pure regex, no API calls, and enrichOffer fills blanks only, so a value
 * that came from the extraction model or a feed mapper is never overwritten.
 *
 * Run: npx tsx scripts/reenrich-catalog.ts
 */

const dataDir = join(process.cwd(), "data");
const scannedPath = join(dataDir, "scanned-offers.json");
const seedPath = join(dataDir, "seed.json");

const catalog = JSON.parse(readFileSync(scannedPath, "utf8")) as ScannedOfferCatalog;
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;

const before = countFields(catalog);
const enriched: ScannedOfferCatalog = { ...catalog, offers: catalog.offers.map(enrichOffer) };

if (enriched.offers.length !== catalog.offers.length) {
  throw new Error(`row count changed: ${catalog.offers.length} -> ${enriched.offers.length}; aborting`);
}
assertScannedOfferCatalog(enriched);

const after = countFields(enriched);
console.log(`re-enriched ${enriched.offers.length} offers\n`);
for (const field of Object.keys(after).sort()) {
  const delta = after[field] - (before[field] ?? 0);
  console.log(`  ${field.padEnd(20)} ${String(after[field]).padStart(5)}${delta > 0 ? `  (+${delta})` : ""}`);
}

writeJson(scannedPath, enriched);
writeJson(seedPath, syncScannedOffers(seed, enriched));
console.log(`\nwrote ${scannedPath} and ${seedPath}`);

function countFields(source: ScannedOfferCatalog): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of source.offers) {
    for (const [key, value] of Object.entries(offer)) {
      if (value !== undefined) counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

// Temp file then rename, so an interrupted write cannot truncate the catalog.
function writeJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}
