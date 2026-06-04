import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getCategoryLabel, isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categoryParam } = await params;

  if (!isOfferCategory(categoryParam)) {
    notFound();
  }

  const query = await searchParams;
  const bankId = firstParam(query.bank);
  const search = firstParam(query.search);
  const offers = filterOffers(await getActiveOffers(), { bankId, category: categoryParam, search });

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{getCategoryLabel(categoryParam)} card offers</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Browse {getCategoryLabel(categoryParam).toLowerCase()} offers across Sri Lankan banks.
        </p>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCategory={categoryParam} search={search} actionPath={`/categories/${categoryParam}`} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <p className="text-sm font-medium text-slate-600">{offers.length} active offers found</p>
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
