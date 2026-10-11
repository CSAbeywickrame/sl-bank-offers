import { feedMappers } from "@/lib/ingest/feedMappers";
import type { BankRegistryEntry } from "@/lib/sources/bankRegistry";
import type { BankKind } from "@/lib/ingest/forceExtract";

// Which refresh branch a bank takes: crawl recipe first, then deterministic feed mapper, else Claude.
export function bankRunKind(entry: Pick<BankRegistryEntry, "bankId" | "sources">): BankKind {
  if (entry.sources.some((s) => s.crawl)) return "crawl";
  return feedMappers[entry.bankId] ? "feed" : "claude";
}
