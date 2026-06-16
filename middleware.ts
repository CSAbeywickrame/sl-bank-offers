import { NextRequest, NextResponse } from "next/server";

// Max requests allowed per IP within the rate-limit window
const RATE_LIMIT_MAX = 60;

// Sliding window duration in milliseconds (60 seconds)
const RATE_LIMIT_WINDOW_MS = 60_000;

// Known-good crawlers that must never be rate-limited (preserves SEO and GEO indexing)
const ALLOWED_CRAWLERS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandex",
  "applebot",
  "gptbot",
  "claudebot",
  "perplexitybot",
  "google-extended",
  "oai-searchbot",
  "chatgpt-user",
];

// NOTE: per-instance on serverless/edge runtimes — counters are approximate by design.
// This store is not shared across instances; it is a best-effort scraper guardrail only.
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

// Extracts the client IP from x-forwarded-for or x-real-ip headers
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Returns true if the User-Agent matches any known-good crawler substring
function isAllowedCrawler(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent")?.toLowerCase() ?? "";
  return ALLOWED_CRAWLERS.some((bot) => ua.includes(bot));
}

// Edge middleware: rate-limits aggressive scrapers while allowing legitimate crawlers through
export function middleware(request: NextRequest): NextResponse {
  if (isAllowedCrawler(request)) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const now = Date.now();

  // Prune entries whose window has fully expired to prevent unbounded Map growth
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return NextResponse.next();
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000
    );
    return new NextResponse("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.next();
}

// Excludes static assets, images, metadata files, and the /brand folder from rate limiting
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|brand/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$).*)",
  ],
};
