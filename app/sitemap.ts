import type { MetadataRoute } from "next";
import { getBanks } from "@/lib/offers/banks";
import { categories } from "@/lib/offers/categories";
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

  const offerEntries: MetadataRoute.Sitemap = activeOffers.map((offer) => ({
    url: `${siteUrl}/offers/${offer.id}`,
    changeFrequency: "weekly",
    priority: 0.6,
    lastModified: offer.lastCheckedAt ? new Date(offer.lastCheckedAt) : undefined,
  }));

  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/categories`, changeFrequency: "weekly", priority: 0.8 },
    ...bankEntries,
    ...categoryEntries,
    ...offerEntries,
  ];
}
