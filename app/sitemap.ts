import type { MetadataRoute } from "next";
import { getBanks } from "@/lib/offers/banks";
import { getAllOffers } from "@/lib/offers/repository";
import { offerCategories } from "@/lib/offers/types";
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

  const categoryEntries: MetadataRoute.Sitemap = offerCategories.map((cat) => ({
    url: `${siteUrl}/categories/${cat}`,
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
