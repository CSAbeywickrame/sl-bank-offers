import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { getCategoryLabel, isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Extracts the first string value from a query parameter that may be an array
function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Category-scoped offers page — filter submissions stay on /categories/:category via actionPath
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categoryParam } = await params;

  if (!isOfferCategory(categoryParam)) {
    notFound();
  }

  const query = await searchParams;
  const bankId = firstParam(query.bank);
  const cardId = firstParam(query.card);
  const search = firstParam(query.search);
  const offers = filterOffers(await getActiveOffers(), { bankId, cardId, category: categoryParam, search });
  const banks = getBanks();
  const cards = getCards();

  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Category</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{getCategoryLabel(categoryParam)} card offers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse {getCategoryLabel(categoryParam).toLowerCase()} offers across Sri Lankan banks.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-600">{offers.length} active offer{offers.length !== 1 ? "s" : ""}</p>
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
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
