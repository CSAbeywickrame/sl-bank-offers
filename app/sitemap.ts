import type { MetadataRoute } from "next";
import { getBanks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";
import { getMerchantSummaries } from "@/lib/offers/merchants";
import { getAllOffers } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const banks = getBanks();
  const allOffers = await getAllOffers();
  const activeOffers = allOffers.filter((o) => o.status === "active");

  const bankEntries: MetadataRoute.Sitemap = banks.map((bank) => ({
    url: `${siteUrl}/banks/${bank.id}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Only the categories the site actually lists — the taxonomy superset includes verticals that no
  // offer carries yet, and submitting empty pages to search engines helps nobody.
  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/categories/${category.id}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // Merchants at more than one bank first: those pages carry a real comparison, which is what makes
  // them worth indexing. Single-bank merchant pages are reachable from /merchants but largely
  // duplicate the offer page they point at.
  const merchantEntries: MetadataRoute.Sitemap = (await getMerchantSummaries())
    .filter((merchant) => merchant.bankCount > 1)
    .map((merchant) => ({
      url: `${siteUrl}/merchants/${merchant.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const offerEntries: MetadataRoute.Sitemap = activeOffers.map((offer) => ({
    url: `${siteUrl}/offers/${offer.id}`,
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: offer.lastCheckedAt ? new Date(offer.lastCheckedAt) : undefined,
  }));

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/merchants`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...bankEntries,
    ...categoryEntries,
    ...merchantEntries,
    ...offerEntries,
  ];
}
