const RETURN_VISIT_STORAGE_KEY = "cardcompass:last-visit-at";
const RETURN_VISIT_WINDOW_MS = 30 * 60 * 1000;

interface ReturnVisitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface AnalyticsPathOptions {
  isReturnVisit?: boolean;
}

function hasSearchValue(url: URL): boolean {
  return url.searchParams.get("search")?.trim().length ? true : false;
}

function hasFilterSelection(url: URL): boolean {
  return ["bank", "card", "category"].some((key) => Boolean(url.searchParams.get(key)?.trim()));
}

export function buildAnalyticsPath(url: URL, { isReturnVisit = false }: AnalyticsPathOptions = {}): string | null {
  const hasSearch = hasSearchValue(url);
  const hasFilters = hasFilterSelection(url);

  if (!hasSearch && !hasFilters && !isReturnVisit) {
    return null;
  }

  const path = ["/__analytics"];

  if (isReturnVisit) {
    path.push("return-visit");
  }

  if (hasSearch) {
    path.push("search");
  } else if (hasFilters) {
    path.push("filter");
  }

  return path.join("/");
}

export function shouldTrackReturnVisit(lastSeenAt: string | null, now: Date): boolean {
  if (!lastSeenAt) {
    return false;
  }

  const previousVisit = new Date(lastSeenAt);
  if (!Number.isFinite(previousVisit.getTime())) {
    return false;
  }

  return now.getTime() - previousVisit.getTime() >= RETURN_VISIT_WINDOW_MS;
}

export function consumeReturnVisitSignal(storage: ReturnVisitStorage, now: Date): boolean {
  const lastSeenAt = storage.getItem(RETURN_VISIT_STORAGE_KEY);
  const isReturnVisit = shouldTrackReturnVisit(lastSeenAt, now);

  storage.setItem(RETURN_VISIT_STORAGE_KEY, now.toISOString());

  return isReturnVisit;
}

export function rewriteAnalyticsUrl(eventUrl: string, isReturnVisit: boolean): string | null {
  const url = new URL(eventUrl);
  const analyticsPath = buildAnalyticsPath(url, { isReturnVisit });

  if (!analyticsPath) {
    return null;
  }

  url.pathname = analyticsPath;
  url.search = "";

  return url.toString();
}
