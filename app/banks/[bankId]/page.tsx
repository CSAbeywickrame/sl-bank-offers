import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getBankById } from "@/lib/offers/banks";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";

interface BankPageProps {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BankPage({ params, searchParams }: BankPageProps) {
  const { bankId } = await params;
  const bank = getBankById(bankId);

  if (!bank) {
    notFound();
  }

  const query = await searchParams;
  const categoryParam = firstParam(query.category);
  const search = firstParam(query.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const offers = filterOffers(await getActiveOffers(), { bankId, category, search });

  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{bank.shortName} credit card offers</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Browse active offers collected for {bank.name}. Open each official bank link to confirm final terms.
        </p>
      </section>

      <FilterPanel selectedBankId={bankId} selectedCategory={category} search={search} actionPath={`/banks/${bankId}`} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <p className="text-sm font-medium text-slate-600">{offers.length} active offers found</p>
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
