import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { getBankById, getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

interface BankPageProps {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Extracts the first string value from a query parameter that may be an array
function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
  const cardId = firstParam(query.card);
  const categoryParam = firstParam(query.category);
  const search = firstParam(query.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const offers = filterOffers(await getActiveOffers(), { bankId, cardId, category, search });
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
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Bank</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{bank.shortName} credit card offers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse active offers collected for {bank.name}. Open each official bank link to confirm final terms.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-600">{offers.length} active offer{offers.length !== 1 ? "s" : ""}</p>
        </div>
      </section>

      <FilterPanel
        banks={banks}
        cards={cards}
        selectedBankId={bankId}
        selectedCardId={cardId}
        selectedCategory={category}
        search={search}
        actionPath={`/banks/${bankId}`}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>
    </main>
  );
}
