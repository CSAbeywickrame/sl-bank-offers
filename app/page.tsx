import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { HeroCardStack } from "@/components/HeroCardStack";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { OfferPagination } from "@/components/OfferPagination";
import { AdSlot } from "@/components/AdSlot";
import { StatTile } from "@/components/StatTile";
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

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which Sri Lankan bank has the best credit card offers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Commercial Bank, Sampath Bank, and Seylan Bank regularly publish the most credit card offers across dining, fuel, and supermarket categories in Sri Lanka. The best bank depends on your spending habits — use SL Card Offers to filter and compare live deals from all 14 tracked banks side by side.",
      },
    },
    {
      "@type": "Question",
      name: "How do I compare credit card offers in Sri Lanka?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit SL Card Offers at slcardoffers.com to browse 1,000+ active deals from 14 Sri Lankan banks in one place. Filter by bank, card, or category (dining, fuel, travel, supermarket, cashback, and more) to find offers that match your lifestyle. Each listing links directly to the official bank page so you can verify terms before using an offer.",
      },
    },
    {
      "@type": "Question",
      name: "How often are the credit card offers updated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers is updated regularly as banks publish new promotions. Each offer card shows a 'last checked' date so you can see how recently the information was verified. Always confirm final terms at the official bank website before redeeming an offer.",
      },
    },
    {
      "@type": "Question",
      name: "Does SL Card Offers cover all Sri Lankan banks?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers currently tracks 14 Sri Lankan banks including Commercial Bank, Sampath Bank, BOC, People's Bank, NDB, NTB, Seylan Bank, DFCC, Pan Asia Bank, Standard Chartered, Union Bank, Cargills Bank, NSB, and HNB. More banks are added as their offer data becomes available.",
      },
    },
    {
      "@type": "Question",
      name: "What categories of credit card offers are available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers lists deals across nine categories: dining, fuel, supermarket, travel, online shopping, installment plans, cashback, buy-one-get-one (BOGO), and other promotions. Use the category filter on the homepage to narrow your search.",
      },
    },
  ],
};

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

  const totalCount = Math.floor(allOffers.length / 100) * 100;;

  return (
    <main>
      <JsonLd data={faqJsonLd} />

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "#fff" }}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-orb hero-orb-accent" />
          <div className="hero-dots" />
          <div className="hero-shine" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_400px] min-[900px]:items-center">
            <div className="max-w-xl">
              {/* Eyebrow pill */}
              <p
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{
                  background: "var(--hero-eyebrow-bg)",
                  border: "1px solid var(--hero-eyebrow-bg)",
                  color: "var(--hero-eyebrow-fg)",
                  borderRadius: "9999px",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    background: "currentColor",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                Sri Lankan credit card offers
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                Compare {totalCount}+ Sri Lankan Credit Card Offers{" "}
                <span style={{ color: "var(--hero-highlight)" }}>from 10+ Banks</span>
              </h1>
              <p
                className="mt-4 text-base"
                style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}
              >
                Compare active credit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 max-w-md">
                <StatTile
                  value={filteredOffers.length}
                  label={filteredOffers.length === allOffers.length ? "active offers" : "matching offers"}
                  className="flex-1"
                />
                <StatTile value={banks.length} label="banks tracked" className="flex-1" />
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
      />

      <AdSlot className="mt-5" />

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
