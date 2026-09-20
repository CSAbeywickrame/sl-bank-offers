import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StatTile } from "@/components/StatTile";
import { getBanks } from "@/lib/offers/banks";
import { getMerchantSummaries } from "@/lib/offers/merchants";
import { getActiveOffers } from "@/lib/offers/repository";
import { siteName, siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About & How We Collect Offers",
  description:
    "Where Sri Lankan Card Offers gets its data, how often it refreshes, how the crawler behaves, and how to report an offer that is wrong or out of date.",
  openGraph: {
    title: "About & How We Collect Offers",
    description: "How Sri Lankan Card Offers collects, refreshes and verifies bank card offers.",
    url: `${siteUrl}/about`,
  },
  alternates: { canonical: `${siteUrl}/about` },
};

const REPO_URL = "https://github.com/CSAbeywickrame/sl-bank-offers";

export default async function AboutPage() {
  // Counted live rather than written into the copy: a stale number on the page that explains how
  // fresh the data is would undermine the only thing this page exists to establish.
  const [offers, merchants] = await Promise.all([getActiveOffers(), getMerchantSummaries()]);
  const banks = getBanks();
  const lastChecked = offers
    .map((offer) => offer.lastCheckedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "About", item: `${siteUrl}/about` },
    ],
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />

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
                About
              </li>
            </ol>
          </nav>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <h1 className="font-bold" style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}>
                Every Sri Lankan card offer,{" "}
                <span style={{ color: "var(--hero-highlight)" }}>in one place</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}>
                {siteName} collects the card promotions Sri Lankan banks publish on their own
                websites and puts them side by side, so you can see which of your cards saves you
                most before you spend.
              </p>
            </div>
            <div className="flex gap-3">
              <StatTile value={offers.length} label="live offers" />
              <StatTile value={banks.length} label="banks" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
        <Section title="Where the data comes from">
          <p>
            Every offer is read from the bank&rsquo;s own public promotions pages — the same pages you
            would find yourself. Nothing is bought from a third party, and nothing is written by
            hand. Each offer keeps a link back to the bank&rsquo;s page, which is the authority: if
            this site and the bank disagree, the bank is right.
          </p>
          <p>
            {banks.length} banks are covered today: {banks.map((bank) => bank.shortName).join(", ")}.
            Currently tracking {merchants.toLocaleString()} merchants across {offers.length.toLocaleString()}{" "}
            live offers.
          </p>
        </Section>

        <Section title="How often it updates">
          <p>
            Every bank is re-read once a week, early on Monday morning. Each offer shows the date it
            was last confirmed against the bank&rsquo;s page, so you can judge for yourself how fresh
            it is rather than trusting the site&rsquo;s word.
            {lastChecked && ` The most recent check was ${formatDate(lastChecked)}.`}
          </p>
          <p>
            Offers disappear from the site once their end date passes. Banks often set those dates to
            the end of a month, so the number of live offers dips at a month boundary and recovers
            with the next refresh.
          </p>
        </Section>

        <Section title="How the crawler behaves">
          <p>
            Pages are fetched by a bot that identifies itself as{" "}
            <code className="rounded bg-(--surface-muted) px-1.5 py-0.5 text-[13px]">SLBankOffersBot</code>, with a
            link to its source code so any bank can see exactly what it does. It reads each bank once
            a week rather than continuously, requests only the public promotion pages, and waits
            between retries instead of hammering a slow server.
          </p>
          <p>
            If you run one of these sites and would like the crawler to change its behaviour or stop
            entirely, ask via the{" "}
            <a className="text-(--text-link) hover:underline" href={REPO_URL} target="_blank" rel="noreferrer">
              project repository
            </a>{" "}
            and it will be honoured.
          </p>
        </Section>

        <Section title="What this site does not do">
          <p>
            It is not affiliated with any bank, and it is not financial advice. Offers are summarised
            for comparison, not reproduced in full — terms, exclusions and minimum spends can change
            without notice, so confirm anything that matters with your bank before you rely on it.
          </p>
          <p>
            Some details are read out of the wording banks use, so an offer occasionally shows a
            discount, date or card restriction that its terms state differently. Where an offer says
            nothing about which cards qualify, it is shown as open to all — which is usually right,
            but not a guarantee.
          </p>
        </Section>

        <Section title="Something wrong?">
          <p>
            If an offer is out of date, misread, or should not be listed, report it through the{" "}
            <a className="text-(--text-link) hover:underline" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
              issue tracker
            </a>
            . Include the link to the offer page and what is wrong with it. Corrections are made as
            soon as they are confirmed against the bank&rsquo;s own page.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-(--text-strong)">{title}</h2>
      <div className="mt-3 grid gap-3 text-sm leading-(--lh-relaxed) text-(--text-body)">{children}</div>
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date)
    : "recently";
}
