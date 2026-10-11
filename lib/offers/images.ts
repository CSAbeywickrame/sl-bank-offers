import { siteUrl } from "@/lib/site-config";

// True for an absolute http(s) URL string; the one definition shared by mappers, ingest and pages.
export function isAbsoluteHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

// Resolves an offer image to an absolute URL for OpenGraph and JSON-LD, which crawlers can't resolve relatively
export function absoluteImageUrl(imageUrl: string, base: string = siteUrl): string {
  const path: string = imageUrl; // the type guard would narrow `imageUrl` to never below
  if (isAbsoluteHttpUrl(path)) return path;
  return `${base.replace(/\/+$/, "")}/${imageUrl.replace(/^\/+/, "")}`;
}
