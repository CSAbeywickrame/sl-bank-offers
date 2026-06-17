import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { OfferPagination } from "@/components/OfferPagination";
import { getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { getCategoryLabel, isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { firstQueryValue, paginateItems, parsePaginationParams } from "@/lib/offers/pagination";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categoryParam } = await params;
  if (!isOfferCategory(categoryParam)) return {};

  const label = getCategoryLabel(categoryParam);
  const title = `${label} Credit Card Offers in Sri Lanka`;
  const description = `Find the best ${label.toLowerCase()} credit card offers across Sri Lankan banks. Compare deals and save more.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${siteUrl}/categories/${categoryParam}` },
    alternates: { canonical: `${siteUrl}/categories/${categoryParam}` },
  };
}

// Category-scoped offers page — filter submissions stay on /categories/:category via actionPath
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categoryParam } = await params;

  if (!isOfferCategory(categoryParam)) {
    notFound();
  }

  const query = await searchParams;
  const bankId = firstQueryValue(query.bank);
  const cardId = firstQueryValue(query.card);
  const search = firstQueryValue(query.search);
  const pagination = parsePaginationParams(query);
  const filteredOffers = filterOffers(await getActiveOffers(), { bankId, cardId, category: categoryParam, search });
  const paginatedOffers = paginateItems(filteredOffers, pagination);
  const banks = getBanks();
  const cards = getCards();

  const label = getCategoryLabel(categoryParam);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: `${label} Offers`, item: `${siteUrl}/categories/${categoryParam}` },
    ],
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <section className="relative overflow-hidden" style={{ background: "#08271c", color: "#fff" }}>
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-orb hero-orb-accent" />
          <div className="hero-dots" />
          <div className="hero-shine" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{
                  background: "rgba(212, 175, 95, 0.16)",
                  border: "1px solid rgba(212, 175, 95, 0.16)",
                  color: "#e1c46e",
                  borderRadius: "9999px",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#d4af5f", display: "inline-block", flexShrink: 0 }}
                />
                Category
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                {getCategoryLabel(categoryParam)}{" "}
                <span style={{ color: "#d4af5f" }}>Card Offers</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
                Browse {getCategoryLabel(categoryParam).toLowerCase()} offers across Sri Lankan banks.
              </p>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px",
                padding: "16px 20px",
                minWidth: "180px",
                textAlign: "center",
              }}
            >
              <span className="block font-bold text-white" style={{ fontSize: "30px" }}>
                {filteredOffers.length}
              </span>
              <span className="mt-0.5 block text-sm" style={{ color: "rgba(255,255,255,0.78)" }}>
                active offer{filteredOffers.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      <FilterPanel
        banks={banks}
        cards={cards}
        selectedBankId={bankId}
        selectedCardId={cardId}
        selectedCategory={categoryParam}
        search={search}
        actionPath={`/categories/${categoryParam}`}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {filteredOffers.length > 0 ? (
          <>
            {/* <OfferPagination
              actionPath={`/categories/${categoryParam}`}
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
              actionPath={`/categories/${categoryParam}`}
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
