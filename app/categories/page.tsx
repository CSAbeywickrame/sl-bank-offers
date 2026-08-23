import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StatTile } from "@/components/StatTile";
import { categories } from "@/lib/offers/categories";
import type { OfferCategory } from "@/lib/offers/types";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteName, siteUrl } from "@/lib/site-config";

// One line per vertical. Keyed by OfferCategory so a new category cannot ship without copy —
// `Record<OfferCategory, string>` makes the compiler ask for it.
const categoryDescriptions: Record<OfferCategory, string> = {
  hotels: "Room rates, resort stays, and half- and full-board packages.",
  dining: "Restaurant, cafe, bar, and food delivery discounts.",
  home: "Furniture, homeware, and everything for fitting out a house.",
  travel: "Flights, tours, airport services, and travel bookings.",
  health: "Hospitals, pharmacies, labs, and salon and gym memberships.",
  fashion: "Clothing, footwear, jewellery, and accessories.",
  electronics: "Phones, computers, cameras, and home appliances.",
  automotive: "Vehicle servicing, spare parts, tyres, and car care.",
  supermarket: "Grocery and supermarket discounts across major chains.",
  leisure: "Cinemas, events, sports, books, and days out with the family.",
  online: "E-commerce marketplaces and app-only savings.",
  fuel: "Savings on fuel station spend.",
  other: "Insurance, telecom, education, and promotions outside the verticals.",
};

export const metadata: Metadata = {
  title: "All Offer Categories",
  description:
    "Browse every Sri Lankan card offer by category — hotels, dining, supermarkets, electronics, health, travel, and more.",
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
              <li className="font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
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
                  borderRadius: "9999px",
                  padding: "4px 12px",
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  className="hero-dot-pulse"
                  style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "currentColor", display: "inline-block", flexShrink: 0 }}
                />
                Browse offer types
              </p>
              <h1 className="mt-4 font-bold" style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                All <span style={{ color: "var(--hero-highlight)" }}>Offer Categories</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
                Jump into hotels, dining, supermarkets, electronics, health, and every other category tracked across Sri Lankan bank cards.
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
                  className="group flex h-full flex-col justify-between rounded-lg border border-neutral-200 bg-white px-5 py-[18px] shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md"
                  aria-label={`${category.label} — ${count} active offer${count !== 1 ? "s" : ""}`}
                >
                  <div>
                    <p className="text-[18px] font-semibold text-neutral-900">
                      {category.label}
                    </p>
                    <p className="mt-2 text-sm leading-[1.6] text-neutral-600">
                      {categoryDescriptions[category.id]}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
                      {count} active offer{count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold text-emerald-700" aria-hidden="true">
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
