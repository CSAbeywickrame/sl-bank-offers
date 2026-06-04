import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type { Offer, OfferStatus } from "@/lib/offers/types";

export function readStoredOffers(filePath: string): Offer[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  return JSON.parse(raw) as Offer[];
}

export function writeStoredOffers(filePath: string, offers: Offer[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(offers, null, 2)}\n`, "utf8");
}

function isExpired(offer: Offer, nowIso: string): boolean {
  return Boolean(offer.validUntil && new Date(offer.validUntil).getTime() < new Date(nowIso).getTime());
}

export function mergeOffers(existing: Offer[], incoming: Offer[], nowIso: string): Offer[] {
  const nextById = new Map(incoming.map((offer) => [offer.id, offer]));
  const merged: Offer[] = [];

  for (const prior of existing) {
    const fresh = nextById.get(prior.id);
    if (!fresh) {
      merged.push({
        ...prior,
        lastCheckedAt: nowIso,
        status: prior.status === "expired" ? "expired" : "inactive"
      });
      continue;
    }

    const status: OfferStatus = isExpired(fresh, nowIso) ? "expired" : "auto_published";
    merged.push({
      ...prior,
      ...fresh,
      firstSeenAt: prior.firstSeenAt,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status
    });
    nextById.delete(prior.id);
  }

  for (const fresh of nextById.values()) {
    merged.push({
      ...fresh,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastCheckedAt: nowIso,
      status: isExpired(fresh, nowIso) ? "expired" : "auto_published"
    });
  }

  return merged;
}
