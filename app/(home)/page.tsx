import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { HeroCardStack } from "@/components/HeroCardStack";
import { OfferGrid } from "@/components/OfferGrid";
import { OfferPagination } from "@/components/OfferPagination";
import { AdSlot } from "@/components/AdSlot";
import { StatTile } from "@/components/StatTile";
import { getMerchantSummaries } from "@/lib/offers/merchants";
import { getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { filterOffers } from "@/lib/offers/filter";
import { paginateItems, parsePaginationParams } from "@/lib/offers/pagination";
import { parseOfferFilters, parseSortKey } from "@/lib/offers/query";
import { getActiveOffers } from "@/lib/offers/repository";
import { sortOffers } from "@/lib/offers/sort";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const filters = parseOfferFilters(params);
  const sort = parseSortKey(params);
  const pagination = parsePaginationParams(params);

  const allOffers = await getActiveOffers();
  const filteredOffers = sortOffers(filterOffers(allOffers, filters), sort);
  const paginatedOffers = paginateItems(filteredOffers, pagination);
  const banks = getBanks();
  const cards = getCards();
  const merchantCount = (await getMerchantSummaries()).length;

  const totalCount = Math.floor(allOffers.length / 100) * 100;

  return (
    <main>
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
          <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_400px] min-[900px]:items-center">
            <div className="max-w-xl">
              {/* Eyebrow pill */}
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
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "var(--radius-pill)",
                    background: "currentColor",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                Sri Lankan card offers
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}
              >
                Compare {totalCount}+ Sri Lankan Card Offers{" "}
                <span style={{ color: "var(--hero-highlight)" }}>from {banks.length} Banks</span>
              </h1>
              <p
                className="mt-4 text-base"
                style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}
              >
                Compare live credit and debit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 max-w-lg">
                <StatTile
                  value={filteredOffers.length}
                  label={filteredOffers.length === allOffers.length ? "active offers" : "matching offers"}
                  className="flex-1"
                />
                <StatTile value={banks.length} label="banks tracked" className="flex-1" />
                <StatTile value={merchantCount} label="merchants" className="flex-1" />
              </div>
            </div>

            <HeroCardStack />
          </div>
        </div>
      </section>

      <FilterPanel
        banks={banks}
        cards={cards}
        selectedBankIds={filters.bankIds ?? []}
        selectedCategories={filters.categories ?? []}
        selectedCardId={filters.cardId ?? ""}
        selectedSort={sort}
        search={filters.search ?? ""}
        resultCount={filteredOffers.length}
        filters={filters}
      />

      {/* <AdSlot className="mt-5" /> */}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {filteredOffers.length > 0 ? (
          <>
            {/* <OfferPagination
              actionPath="/"
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
              actionPath="/"
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
