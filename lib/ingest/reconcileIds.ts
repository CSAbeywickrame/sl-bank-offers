import { groupOffersBySourceUrl } from "@/lib/ingest/crawlExtract";
import { isActiveOffer } from "@/lib/ingest/importBank";
import { merchantSlug } from "@/lib/offers/merchants";
import type { ScannedOffer } from "@/lib/offers/types";

// Ids are minted from bank + title + sourceUrl, so a re-worded title on re-extraction would mint a
// new id: /offers/<old-id> would 404 and firstSeenAt (restored by id in importBankOffers) would reset.
// This hands a new offer its prior offer's id when the match is unambiguous:
//  - exact id matches always win and claim their prior row first;
//  - (a) the only active prior offer at a sourceUrl and the only new offer at that url, unless both
//    name a merchant and the merchants differ;
//  - (b) otherwise the same non-empty merchant slug at that url, only when exactly one unclaimed prior
//    and exactly one unmatched new offer share it.
// Expired prior offers are never reused, and offers with an empty/unparseable sourceUrl are never
// grouped (see groupOffersBySourceUrl). Anything ambiguous keeps its new id, and one prior id is never
// given to two new offers.
export function reconcileOfferIds(newOffers: ScannedOffer[], priorOffers: ScannedOffer[], reviewDateIso: string): ScannedOffer[] {
  const newIds = new Set(newOffers.map((o) => o.id));
  const priorIds = new Set(priorOffers.map((o) => o.id));
  const priorByUrl = groupOffersBySourceUrl(priorOffers.filter((o) => isActiveOffer(o.validUntil, reviewDateIso)));
  const slugs = new Map<ScannedOffer, string>();
  const slugOf = (o: ScannedOffer): string => {
    let slug = slugs.get(o);
    if (slug === undefined) {
      slug = o.merchant ? merchantSlug(o.merchant) : "";
      slugs.set(o, slug);
    }
    return slug;
  };
  const reassigned = new Map<ScannedOffer, string>();

  for (const [url, newGroup] of groupOffersBySourceUrl(newOffers)) {
    const priorGroup = priorByUrl.get(url) ?? [];
    // Prior rows still free: not kept by an exact-id match in this new batch.
    const free = priorGroup.filter((p) => !newIds.has(p.id));
    const unmatched = newGroup.filter((o) => !priorIds.has(o.id));
    if (free.length === 0 || unmatched.length === 0) continue;

    if (priorGroup.length === 1 && newGroup.length === 1) {
      const [prior, next] = [free[0], unmatched[0]];
      const [priorSlug, nextSlug] = [slugOf(prior), slugOf(next)];
      if (!priorSlug || !nextSlug || priorSlug === nextSlug) reassigned.set(next, prior.id);
      continue;
    }
    const priorBySlug = new Map<string, ScannedOffer[]>();
    for (const p of free) priorBySlug.set(slugOf(p), [...(priorBySlug.get(slugOf(p)) ?? []), p]);
    const newBySlug = new Map<string, ScannedOffer[]>();
    for (const o of unmatched) newBySlug.set(slugOf(o), [...(newBySlug.get(slugOf(o)) ?? []), o]);
    for (const [slug, newHits] of newBySlug) {
      const priorHits = priorBySlug.get(slug);
      if (slug && newHits.length === 1 && priorHits?.length === 1) reassigned.set(newHits[0], priorHits[0].id);
    }
  }
  return newOffers.map((o) => (reassigned.has(o) ? { ...o, id: reassigned.get(o)! } : o));
}
