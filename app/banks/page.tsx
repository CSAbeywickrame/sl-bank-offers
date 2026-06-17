import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getBanks } from "@/lib/offers/banks";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteName, siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Sri Lankan Banks with Credit Card Offers",
  description:
    "Browse credit card offers by bank. Compare active promotions from all major Sri Lankan banks including Commercial Bank, Sampath, BOC, NTB, Seylan, and more.",
  openGraph: {
    title: "Sri Lankan Banks with Credit Card Offers",
    description:
      "Browse credit card offers by bank. Compare active promotions from all major Sri Lankan banks.",
    url: `${siteUrl}/banks`,
  },
  alternates: { canonical: `${siteUrl}/banks` },
};

export default async function BanksPage() {
  const banks = getBanks();
  const allOffers = await getActiveOffers();

  const offerCountByBank = new Map<string, number>();
  for (const offer of allOffers) {
    offerCountByBank.set(offer.bankId, (offerCountByBank.get(offer.bankId) ?? 0) + 1);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Banks", item: `${siteUrl}/banks` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Sri Lankan Banks — ${siteName}`,
    numberOfItems: banks.length,
    itemListElement: banks.map((bank, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: bank.name,
      url: `${siteUrl}/banks/${bank.id}`,
    })),
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-500">
            <ol className="flex items-center gap-1.5">
              <li><Link href="/" className="hover:text-teal-700">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-slate-700">Banks</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Sri Lankan Banks with Credit Card Offers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse active credit card promotions by bank. Select a bank to see all its current offers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {banks.map((bank) => {
            const count = offerCountByBank.get(bank.id) ?? 0;
            return (
              <li key={bank.id}>
                <Link
                  href={`/banks/${bank.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md hover:border-slate-300"
                  aria-label={`${bank.name} — ${count} active offer${count !== 1 ? "s" : ""}`}
                >
                  <div>
                    <p className="font-semibold text-slate-900">{bank.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {count} active offer{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="ml-4 text-teal-600 text-sm font-medium" aria-hidden="true">
                    View →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
