import type { Route } from "next";
import { categories } from "@/lib/offers/categories";
import type { Bank, Offer } from "@/lib/offers/types";
import { countOffersByBank, pluralise } from "@/lib/seo-copy";

export interface FaqItem {
  question: string;
  answer: string;
  /** Optional on-page link shown after the answer; not part of the structured-data text. */
  link?: { href: Route; label: string };
}

// Names the banks with the most live offers, e.g. "Sampath Bank (210 offers), ...".
export function topBanksByOfferCount(banks: Bank[], offers: Offer[], limit = 3): string[] {
  const counts = countOffersByBank(offers);

  return banks
    .map((bank) => ({ name: bank.name, count: counts.get(bank.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => `${entry.name} (${pluralise(entry.count, "offer")})`);
}

// Builds the FAQ from live data so no count or list in an answer can go stale.
export function buildFaqItems(banks: Bank[], offers: Offer[]): FaqItem[] {
  const topBanks = topBanksByOfferCount(banks, offers);
  const categoryLabels = categories.map((category) => category.label);

  return [
    {
      question: "Which banks have the most card offers right now?",
      answer:
        topBanks.length > 0
          ? `Right now the banks with the most live offers are ${topBanks.join(", ")}. Counts change as banks add and retire promotions, and more offers does not mean better offers, so compare the deals themselves.`
          : "There are no live offers to rank at the moment. Check back after the next weekly refresh.",
    },
    {
      question: "How do I compare card offers in Sri Lanka?",
      answer:
        "Use the filters on the offers page to narrow by bank, card, category, offer type, day of the week and minimum discount, then sort the results. Each offer links to its bank's own page, so you can confirm the terms before you spend.",
    },
    {
      question: "How often are offers updated?",
      answer:
        "Every bank is re-read once a week. Each offer shows a last checked date so you can see how recent the information is. Terms can change without notice, so confirm with your bank before you rely on an offer.",
    },
    {
      question: "Which banks do you cover?",
      answer: `We cover ${pluralise(banks.length, "Sri Lankan bank")}: ${banks.map((bank) => bank.name).join(", ")}.`,
    },
    {
      question: "What categories of offers are there?",
      answer: `Offers are grouped by what they are for: ${categoryLabels.join(", ")}. How an offer pays out (a straight discount, an instalment plan, cashback or buy-one-get-one) is a separate offer type that you can filter by on its own.`,
    },
    {
      question: "Are you affiliated with any bank?",
      answer:
        "No. This is an independent site that collects the offers banks publish on their own websites. It is not financial advice.",
      link: { href: "/about", label: "How we collect offers" },
    },
    {
      question: "Do the offers work with debit cards?",
      answer:
        "Some do. Offers list the eligible cards wherever the bank states them, and an offer that names no cards is shown as open to all, which is usually right but not a guarantee. Check the bank's terms for your card.",
    },
  ];
}

// Wraps the FAQ items as schema.org FAQPage structured data using the same text shown on the page.
export function buildFaqJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
