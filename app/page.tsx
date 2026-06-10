import { BankCategoryNav } from "@/components/BankCategoryNav";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { OfferGrid } from "@/components/OfferGrid";
import { getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
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

  const allOffers = await getActiveOffers();
  const offers = filterOffers(allOffers, { bankId, cardId, category, search });
  const banks = getBanks();
  const cards = getCards();

  return (
    <main>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                Sri Lankan credit card offers
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                All bank offers{" "}
                <span className="text-teal-400">in one place</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Compare active credit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
            </div>

            <div className="flex gap-3 sm:flex-col sm:gap-2">
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{offers.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">
                  {offers.length === allOffers.length ? "active offers" : "matching offers"}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{banks.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">banks tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FilterPanel banks={banks} cards={cards} selectedBankId={bankId} selectedCardId={cardId} selectedCategory={category} search={search} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        <BankCategoryNav />
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
