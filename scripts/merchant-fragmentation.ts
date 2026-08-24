import { readFileSync } from "node:fs";
import { join } from "node:path";
import { merchantSlug, resolveMerchant } from "@/lib/offers/merchants";
import type { ScannedOfferCatalog } from "@/lib/offers/types";

/**
 * Candidate report for data/merchant-aliases.json.
 *
 * Finds merchant names that probably describe one place but currently count as several, and prints
 * them for a human to judge. It deliberately proposes nothing: the difference between a spelling
 * variant and a sibling property is a judgement call, and getting it wrong silently merges a
 * restaurant into the hotel that houses it.
 *
 * Run: npx tsx scripts/merchant-fragmentation.ts
 */

const catalog = JSON.parse(
  readFileSync(join(process.cwd(), "data", "scanned-offers.json"), "utf8")
) as ScannedOfferCatalog;

const namesBySlug = new Map<string, Set<string>>();
const banksBySlug = new Map<string, Set<string>>();
for (const offer of catalog.offers) {
  const name = offer.merchant?.trim();
  if (!name) continue;
  const resolved = resolveMerchant(name);
  if (!resolved) continue;
  if (!namesBySlug.has(resolved.slug)) namesBySlug.set(resolved.slug, new Set());
  if (!banksBySlug.has(resolved.slug)) banksBySlug.set(resolved.slug, new Set());
  namesBySlug.get(resolved.slug)!.add(name);
  banksBySlug.get(resolved.slug)!.add(offer.bankId);
}

const slugs = [...namesBySlug.keys()].sort();
const multiBank = slugs.filter((slug) => (banksBySlug.get(slug)?.size ?? 0) > 1);
console.log(`merchants: ${slugs.length} | at more than one bank: ${multiBank.length}`);

// Near-misses: one slug is the other plus a suffix. Usually either a spelling variant (merge) or a
// property and an outlet inside it (do NOT merge) — which is exactly why this only reports.
const pairs: Array<[string, string]> = [];
for (const slug of slugs) {
  for (const other of slugs) {
    if (slug !== other && other.startsWith(`${slug}-`)) pairs.push([slug, other]);
  }
}

console.log(`\n${pairs.length} names extend another name. Merge ONLY if both are the same place:\n`);
for (const [base, extended] of pairs.slice(0, 60)) {
  const suffix = extended.slice(base.length + 1);
  console.log(`  ${base}`);
  console.log(`    + ${suffix.padEnd(38)} -> ${extended}`);
}
if (pairs.length > 60) console.log(`  … ${pairs.length - 60} more`);

// Names that normalise identically already collapse on their own and need no alias entry.
const raw = new Map<string, Set<string>>();
for (const offer of catalog.offers) {
  const name = offer.merchant?.trim();
  if (!name) continue;
  const slug = merchantSlug(name);
  if (!raw.has(slug)) raw.set(slug, new Set());
  raw.get(slug)!.add(name);
}
const autoMerged = [...raw.values()].filter((names) => names.size > 1).length;
console.log(`\n${autoMerged} spellings already unify without an alias entry (punctuation, case, legal suffix).`);
