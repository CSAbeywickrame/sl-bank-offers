import { BankCategoryNav } from "@/components/BankCategoryNav";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const bankId = firstParam(params.bank);
  const cardId = firstParam(params.card);
  const categoryParam = firstParam(params.category);
  const search = firstParam(params.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const offers = filterOffers(await getActiveOffers(), { bankId, cardId, category, search });

  return (
    <main>
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-200">Sri Lankan card offers</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">All bank offers in one place</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Compare active credit card offers by bank and category, then open the official bank source before using the offer.
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm">
            <span className="block text-2xl font-semibold">{offers.length}</span>
            <span className="text-slate-300">matching offers</span>
          </div>
        </div>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCardId={cardId} selectedCategory={category} search={search} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <BankCategoryNav />
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
