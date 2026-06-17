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
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Category</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{getCategoryLabel(categoryParam)} card offers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse {getCategoryLabel(categoryParam).toLowerCase()} offers across Sri Lankan banks.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-600">{filteredOffers.length} active offer{filteredOffers.length !== 1 ? "s" : ""}</p>
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
