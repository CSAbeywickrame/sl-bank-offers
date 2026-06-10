import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScannedOfferCatalog, syncScannedOffers } from "@/lib/offers/scanned";
import type { SeedData } from "@/lib/offers/types";

const seedPath = join(process.cwd(), "data", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedData;
const synced = syncScannedOffers(seed, loadScannedOfferCatalog());

writeFileSync(seedPath, `${JSON.stringify(synced, null, 2)}\n`, "utf8");

console.log(`Synced ${loadScannedOfferCatalog().offers.length} scanned offers into data/seed.json.`);
