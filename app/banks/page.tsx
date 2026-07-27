import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StatTile } from "@/components/StatTile";
import { BankCard } from "@/components/BankCard";
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

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "#fff" }}
      >
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
              <li className="font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>Banks</li>
            </ol>
          </nav>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{
                  background: "var(--hero-eyebrow-bg)",
                  border: "1px solid var(--hero-eyebrow-bg)",
                  color: "var(--hero-eyebrow-fg)",
                  borderRadius: "9999px",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "currentColor", display: "inline-block", flexShrink: 0 }}
                />
                Sri Lankan credit card offers
              </p>
              <h1
                className="mt-4 font-bold"
                style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                Banks with{" "}
                <span style={{ color: "var(--hero-highlight)" }}>Credit Card Offers</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
                Browse active credit card promotions by bank. Select a bank to see all its current offers.
              </p>
            </div>
            <StatTile value={banks.length} label="banks tracked" className="min-w-[180px]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {banks.map((bank) => {
            const count = offerCountByBank.get(bank.id) ?? 0;
            return (
              <li key={bank.id}>
                <BankCard id={bank.id} name={bank.name} count={count} />
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
