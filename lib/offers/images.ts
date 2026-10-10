import { siteUrl } from "@/lib/site-config";

// Resolves an offer image to an absolute URL for OpenGraph and JSON-LD, which crawlers can't resolve relatively
export function absoluteImageUrl(imageUrl: string, base: string = siteUrl): string {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${base.replace(/\/+$/, "")}/${imageUrl.replace(/^\/+/, "")}`;
}
