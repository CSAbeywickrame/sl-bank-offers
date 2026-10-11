import { getBanks } from "@/lib/offers/banks";
import { getActiveOffers } from "@/lib/offers/repository";
import { buildSiteDescription, countBanksWithOffers } from "@/lib/seo-copy";

// Site-wide description counting only banks with a live offer, so the copy never claims coverage it lacks.
export async function getSiteDescription(): Promise<string> {
  return buildSiteDescription(countBanksWithOffers(getBanks(), await getActiveOffers()));
}
