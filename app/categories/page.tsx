import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StatTile } from "@/components/StatTile";
import { categories } from "@/lib/offers/categories";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteName, siteUrl } from "@/lib/site-config";

const categoryDescriptions: Record<string, string> = {
  dining: "Restaurant, cafe, and food delivery discounts.",
  fuel: "Savings on fuel station spend and transport-related deals.",
  supermarket: "Grocery and supermarket discounts across major chains.",
  travel: "Airline, hotel, and travel booking promotions.",
  online: "E-commerce and digital shopping savings.",
  installment: "Easy payment plans and 0% installment offers.",
  cashback: "Statement credit and cashback-driven promotions.",
  bogo: "Buy-one-get-one and companion-style offers.",
  other: "Seasonal and general promotions outside the main categories.",
};

export const metadata: Metadata = {
  title: "All Offer Categories",
  description:
    "Browse every credit card offer category tracked by SL Card Offers, from dining and fuel to travel, cashback, installments, and more.",
  openGraph: {
    title: "All Offer Categories",
    description:
      "Browse every credit card offer category tracked by SL Card Offers.",
    url: `${siteUrl}/categories`,
  },
  alternates: { canonical: `${siteUrl}/categories` },
};

export default async function CategoriesPage() {
  const activeOffers = await getActiveOffers();

  const offerCountByCategory = new Map<string, number>();
  for (const offer of activeOffers) {
    offerCountByCategory.set(offer.category, (offerCountByCategory.get(offer.category) ?? 0) + 1);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${siteUrl}/categories` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Offer categories — ${siteName}`,
    numberOfItems: categories.length,
    itemListElement: categories.map((category, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: category.label,
      url: `${siteUrl}/categories/${category.id}`,
    })),
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "var(--text-on-inverse)" }}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-orb hero-orb-accent" />
          <div className="hero-dots" />
          <div className="hero-shine" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-on-inverse-muted)" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline" style={{ color: "var(--text-on-inverse-muted)" }}>
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "var(--text-on-inverse)" }}>
                Categories
              </li>
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
                  borderRadius: "var(--radius-pill)",
                  padding: "4px 12px",
                  letterSpacing: "var(--ls-wide)",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{ width: "6px", height: "6px", borderRadius: "var(--radius-pill)", background: "currentColor", display: "inline-block", flexShrink: 0 }}
                />
                Browse offer types
              </p>
              <h1 className="mt-4 font-bold" style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}>
                All <span style={{ color: "var(--hero-highlight)" }}>Offer Categories</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}>
                Jump into dining, fuel, travel, cashback, installments, and every other category tracked across Sri Lankan bank cards.
              </p>
            </div>
            <StatTile value={categories.length} label="categories tracked" className="min-w-[180px]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {categories.map((category) => {
            const count = offerCountByCategory.get(category.id) ?? 0;
            return (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.id}`}
                  className="group flex h-full flex-col justify-between rounded-lg border border-(--border-subtle) bg-(--surface-card) px-5 py-[18px] shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-fast) ease-out hover:-translate-y-0.5 hover:border-(--border-default) hover:shadow-md motion-reduce:hover:translate-y-0"
                  aria-label={`${category.label} — ${count} active offer${count !== 1 ? "s" : ""}`}
                >
                  <div>
                    <p className="text-lg font-semibold text-(--text-strong)">
                      {category.label}
                    </p>
                    <p className="mt-2 text-sm leading-[1.6] text-(--text-muted)">
                      {categoryDescriptions[category.id]}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-(--ls-wider) text-(--text-muted)">
                      {count} active offer{count !== 1 ? "s" : ""}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-(--text-link)" aria-hidden="true">
                      View →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
