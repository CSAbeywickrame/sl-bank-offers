import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { OfferPagination } from "@/components/OfferPagination";
import { StatTile } from "@/components/StatTile";
import { getBankById, getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { getCategoryLabel } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";
import { filterOffers } from "@/lib/offers/filter";
import { paginateItems, parsePaginationParams } from "@/lib/offers/pagination";
import { parseOfferFilters, parseSortKey } from "@/lib/offers/query";
import { getActiveOffers } from "@/lib/offers/repository";
import { sortOffers } from "@/lib/offers/sort";
import { siteUrl } from "@/lib/site-config";

interface BankPageProps {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: BankPageProps): Promise<Metadata> {
  const { bankId } = await params;
  const bank = getBankById(bankId);
  if (!bank) return {};

  const title = `${bank.name} Credit Card Offers`;
  const description = `Browse active credit card offers from ${bank.name} in Sri Lanka. Find the best deals on dining, fuel, travel, supermarket, and more.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${siteUrl}/banks/${bankId}` },
    alternates: { canonical: `${siteUrl}/banks/${bankId}` },
  };
}

// Bank-scoped offers page — filter submissions stay on /banks/:bankId via actionPath
export default async function BankPage({ params, searchParams }: BankPageProps) {
  const { bankId } = await params;
  const bank = getBankById(bankId);

  if (!bank) {
    notFound();
  }

  const query = await searchParams;
  const filters = { ...parseOfferFilters(query), bankId, bankIds: undefined };
  const sort = parseSortKey(query);
  const pagination = parsePaginationParams(query);
  const activeOffers = await getActiveOffers();
  const filteredOffers = sortOffers(filterOffers(activeOffers, filters), sort);
  // The bank's own totals, unaffected by whatever the visitor has filtered to — the summary line
  // describes the bank, not the current view.
  const bankOffers = activeOffers.filter((offer) => offer.bankId === bankId);
  const bankDiscounts = bankOffers
    .map((offer) => offer.discountPct)
    .filter((pct): pct is number => typeof pct === "number");
  const bestDiscountPct = bankDiscounts.length > 0 ? Math.max(...bankDiscounts) : undefined;
  const lastChecked = bankOffers.map((offer) => offer.lastCheckedAt).filter(Boolean).sort().at(-1);
  const topCategories = [...bankOffers.reduce((counts, offer) => {
    counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1);
    return counts;
  }, new Map<OfferCategory, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const paginatedOffers = paginateItems(filteredOffers, pagination);
  const banks = getBanks();
  const cards = getCards();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: `${bank.name} Offers`, item: `${siteUrl}/banks/${bankId}` },
    ],
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "var(--text-on-inverse)" }}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-orb hero-orb-accent" />
          <div className="hero-dots" />
          <div className="hero-shine" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-20 sm:pb-24">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-on-inverse-muted)" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline" style={{ color: "var(--text-on-inverse-muted)" }}>
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/banks" className="hover:underline" style={{ color: "var(--text-on-inverse-muted)" }}>
                  Banks
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "var(--text-on-inverse)" }}>{bank.shortName}</li>
            </ol>
          </nav>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{
                  background: "var(--hero-eyebrow-bg)",
                  border: "1px solid var(--hero-eyebrow-bg)",
                  color: "var(--hero-eyebrow-fg)",
                  borderRadius: "var(--radius-pill)",
                  padding: "4px 12px",
                  letterSpacing: "var(--ls-wide)",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{ width: "6px", height: "6px", borderRadius: "var(--radius-pill)", background: "currentColor", display: "inline-block", flexShrink: 0 }}
                />
                Bank
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}
              >
                {bank.shortName}{" "}
                <span style={{ color: "var(--hero-highlight)" }}>Credit Card Offers</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}>
                {bankOffers.length} live offer{bankOffers.length === 1 ? "" : "s"} from {bank.name}
                {bestDiscountPct !== undefined && <> · best is {bestDiscountPct}% off</>}
                {lastChecked && <> · last checked {formatCheckedDate(lastChecked)}</>}.
                {" "}Open the official bank link on any offer to confirm its final terms.
              </p>
              {topCategories.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" role="list">
                  {topCategories.map(([category, count]) => (
                    <li key={category}>
                      <Link
                        href={`/banks/${bankId}?category=${category}`}
                        className="inline-flex items-center gap-1.5 rounded-(--radius-pill) px-3 py-1 text-xs font-semibold"
                        style={{ background: "var(--hero-eyebrow-bg)", color: "var(--hero-eyebrow-fg)" }}
                      >
                        {getCategoryLabel(category)}
                        <span style={{ opacity: 0.75 }}>{count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <StatTile
              value={bankOffers.length}
              label={`active offer${filteredOffers.length !== 1 ? "s" : ""}`}
              className="min-w-[180px]"
            />
          </div>
        </div>
      </section>

      <FilterPanel
        banks={banks}
        cards={cards}
        selectedCategories={filters.categories ?? []}
        selectedCardId={filters.cardId ?? ""}
        selectedSort={sort}
        search={filters.search ?? ""}
        lockedBankId={bankId}
        actionPath={`/banks/${bankId}`}
        resultCount={filteredOffers.length}
        filters={filters}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {filteredOffers.length > 0 ? (
          <>
            {/* <OfferPagination
              actionPath={`/banks/${bankId}`}
              page={paginatedOffers.page}
              pageSize={paginatedOffers.pageSize}
              totalItems={paginatedOffers.totalItems}
              totalPages={paginatedOffers.totalPages}
              startIndex={paginatedOffers.startIndex}
              endIndex={paginatedOffers.endIndex}
            /> */}
            <OfferGrid offers={paginatedOffers.items} />
            <OfferPagination
              navOnly
              actionPath={`/banks/${bankId}`}
              page={paginatedOffers.page}
              pageSize={paginatedOffers.pageSize}
              totalItems={paginatedOffers.totalItems}
              totalPages={paginatedOffers.totalPages}
              startIndex={paginatedOffers.startIndex}
              endIndex={paginatedOffers.endIndex}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </section>
    </main>
  );
}

// Short, unambiguous freshness for the hero line: "23 Aug" reads faster than a full date and does
// not imply more precision than a weekly refresh has.
function formatCheckedDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date)
    : "recently";
}
