// Formats an ISO date the way the whole site shows dates ("Aug 23, 2026"); `fallback` covers
// missing or unparseable values so each caller can keep its own placeholder.
export function formatDate(value: string | undefined, fallback = "Not specified"): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}
