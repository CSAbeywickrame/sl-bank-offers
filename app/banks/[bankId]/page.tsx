import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { OfferPagination } from "@/components/OfferPagination";
import { getBankById, getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { firstQueryValue, paginateItems, parsePaginationParams } from "@/lib/offers/pagination";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

interface BankPageProps {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const cardId = firstQueryValue(query.card);
  const categoryParam = firstQueryValue(query.category);
  const search = firstQueryValue(query.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;
  const pagination = parsePaginationParams(query);
  const filteredOffers = filterOffers(await getActiveOffers(), { bankId, cardId, category, search });
  const paginatedOffers = paginateItems(filteredOffers, pagination);
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
      <section className="relative overflow-hidden" style={{ background: "#08271c", color: "#fff" }}>
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-orb hero-orb-accent" />
          <div className="hero-dots" />
          <div className="hero-shine" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/banks" className="hover:underline" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Banks
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{bank.shortName}</li>
            </ol>
          </nav>
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
                Bank
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                {bank.shortName}{" "}
                <span style={{ color: "#d4af5f" }}>Credit Card Offers</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
                Browse active offers collected for {bank.name}. Open each official bank link to confirm final terms.
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
        selectedCategory={category}
        search={search}
        actionPath={`/banks/${bankId}`}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {filteredOffers.length > 0 ? (
          <>
            {/* <OfferPagination
              actionPath={`/banks/${bankId}`}
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
              actionPath={`/banks/${bankId}`}
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
