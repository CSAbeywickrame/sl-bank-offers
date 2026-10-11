import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { buildFaqItems, buildFaqJsonLd } from "@/lib/faq";
import { getBanks } from "@/lib/offers/banks";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

const description =
  "Answers to common questions about Sri Lankan card offers: which banks have the most, how to compare them, how often they update and whether they work with debit cards.";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description,
  openGraph: { title: "Frequently Asked Questions", description, url: `${siteUrl}/faq` },
  alternates: { canonical: `${siteUrl}/faq` },
};

export default async function FaqPage() {
  // Built from live data at render time so the counts and lists in the answers never go stale.
  const items = buildFaqItems(getBanks(), await getActiveOffers());

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "FAQ", item: `${siteUrl}/faq` },
    ],
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={buildFaqJsonLd(items)} />

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "var(--text-on-inverse)" }}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-dots" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-on-inverse-muted)" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "var(--text-on-inverse)" }}>
                FAQ
              </li>
            </ol>
          </nav>
          <div className="max-w-2xl">
            <h1 className="font-bold" style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}>
              Sri Lankan card offers,{" "}
              <span style={{ color: "var(--hero-highlight)" }}>your questions answered</span>
            </h1>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
        {items.map((item) => (
          <section key={item.question}>
            <h2 className="text-xl font-semibold text-(--text-strong)">{item.question}</h2>
            <div className="mt-3 grid gap-3 text-sm leading-(--lh-relaxed) text-(--text-body)">
              <p>{item.answer}</p>
              {item.link && (
                <p>
                  <Link href={item.link.href} className="text-(--text-link) hover:underline">
                    {item.link.label}
                  </Link>
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
