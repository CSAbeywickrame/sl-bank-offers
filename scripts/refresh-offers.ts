import { refreshOffers } from "@/lib/ingest/ingest";

const summary = await refreshOffers();

console.log(JSON.stringify(summary, null, 2));

if (summary.failures.length > 0 && summary.offersFound === 0) {
  process.exitCode = 1;
}
