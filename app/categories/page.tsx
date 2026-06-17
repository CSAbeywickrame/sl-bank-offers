import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
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
                Browse offer types
              </p>
              <h1 className="mt-4 font-bold" style={{ fontSize: "44px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                All <span style={{ color: "#d4af5f" }}>Offer Categories</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
                Jump into dining, fuel, travel, cashback, installments, and every other category tracked across Sri Lankan bank cards.
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
                {categories.length}
              </span>
              <span className="mt-0.5 block text-sm" style={{ color: "rgba(255,255,255,0.78)" }}>
                categories tracked
              </span>
            </div>
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
                  className="group flex h-full flex-col justify-between rounded-xl bg-white transition-all duration-150 hover:border-neutral-300 hover:shadow-md"
                  style={{
                    padding: "18px 20px",
                    border: "1px solid #dde7e1",
                    boxShadow: "0 1px 2px rgb(15 23 42 / 5%)",
                  }}
                  aria-label={`${category.label} — ${count} active offer${count !== 1 ? "s" : ""}`}
                >
                  <div>
                    <p className="font-semibold" style={{ fontSize: "18px", color: "#16201b" }}>
                      {category.label}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "#6a7d73", lineHeight: 1.6 }}>
                      {categoryDescriptions[category.id]}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "#6a7d73" }}>
                      {count} active offer{count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "#047857" }} aria-hidden="true">
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
