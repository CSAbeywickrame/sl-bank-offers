import { EmptyState } from "@/components/EmptyState";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { OfferGrid } from "@/components/OfferGrid";
import { getBanks } from "@/lib/offers/banks";
import { getCards } from "@/lib/offers/cards";
import { isOfferCategory } from "@/lib/offers/categories";
import { filterOffers } from "@/lib/offers/filter";
import { getActiveOffers } from "@/lib/offers/repository";
import Link from "next/link";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which Sri Lankan bank has the best credit card offers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Commercial Bank, Sampath Bank, and Seylan Bank regularly publish the most credit card offers across dining, fuel, and supermarket categories in Sri Lanka. The best bank depends on your spending habits — use SL Card Offers to filter and compare live deals from all 12 tracked banks side by side.",
      },
    },
    {
      "@type": "Question",
      name: "How do I compare credit card offers in Sri Lanka?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit SL Card Offers at slcardoffers.com to browse 1,000+ active deals from 12 Sri Lankan banks in one place. Filter by bank, card, or category (dining, fuel, travel, supermarket, cashback, and more) to find offers that match your lifestyle. Each listing links directly to the official bank page so you can verify terms before using an offer.",
      },
    },
    {
      "@type": "Question",
      name: "How often are the credit card offers updated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers is updated regularly as banks publish new promotions. Each offer card shows a 'last checked' date so you can see how recently the information was verified. Always confirm final terms at the official bank website before redeeming an offer.",
      },
    },
    {
      "@type": "Question",
      name: "Does SL Card Offers cover all Sri Lankan banks?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers currently tracks 12 Sri Lankan banks including Commercial Bank, Sampath Bank, BOC, People's Bank, NDB, NTB, Seylan Bank, DFCC, Pan Asia Bank, Standard Chartered, Union Bank, and Cargills Bank. More banks are added as their offer data becomes available.",
      },
    },
    {
      "@type": "Question",
      name: "What categories of credit card offers are available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SL Card Offers lists deals across nine categories: dining, fuel, supermarket, travel, online shopping, installment plans, cashback, buy-one-get-one (BOGO), and other promotions. Use the category filter on the homepage to narrow your search.",
      },
    },
  ],
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const bankId = firstParam(params.bank);
  const cardId = firstParam(params.card);
  const categoryParam = firstParam(params.category);
  const search = firstParam(params.search);
  const category = isOfferCategory(categoryParam) ? categoryParam : undefined;

  const allOffers = await getActiveOffers();
  const offers = filterOffers(allOffers, { bankId, cardId, category, search });
  const banks = getBanks();
  const cards = getCards();

  const totalCount = allOffers.length;
  const bankCount = banks.length;

  return (
    <main>
      <JsonLd data={faqJsonLd} />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                Sri Lankan credit card offers
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                Compare {totalCount.toLocaleString()}+ Sri Lankan Credit Card Offers{" "}
                <span className="text-teal-400">from {bankCount}+ Banks</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Compare active credit card offers across Sri Lankan banks and categories.
                Always verify details at the official bank source before using an offer.
              </p>
            </div>

            <div className="flex gap-3 sm:flex-col sm:gap-2">
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{offers.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">
                  {offers.length === allOffers.length ? "active offers" : "matching offers"}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-white/10 bg-white/8 px-5 py-4 text-center sm:text-left backdrop-blur-sm">
                <span className="block text-3xl font-bold text-white">{banks.length}</span>
                <span className="mt-0.5 block text-sm text-slate-400">banks tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FilterPanel banks={banks} cards={cards} selectedBankId={bankId} selectedCardId={cardId} selectedCategory={category} search={search} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
        {offers.length > 0 ? <OfferGrid offers={offers} /> : <EmptyState />}
      </section>

      {/* <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-xl font-bold text-slate-900 mb-4">About SL Card Offers</h2>
          <div className="prose prose-slate max-w-none text-sm leading-7 text-slate-600 space-y-4">
            <p>
              SL Card Offers is Sri Lanka&rsquo;s most comprehensive credit card offer aggregator, tracking {totalCount.toLocaleString()}+ active promotions from {bankCount} banks including Commercial Bank, Sampath Bank, BOC, People&rsquo;s Bank, NDB, NTB, Seylan Bank, DFCC, Pan Asia Bank, Standard Chartered, Union Bank, and Cargills Bank.
            </p>
            <p>
              Finding the best credit card deal in Sri Lanka used to mean visiting each bank&rsquo;s website separately. SL Card Offers solves that by pulling all active promotions into one searchable, filterable listing. Every offer links back to the official bank source so you can confirm terms before redeeming.
            </p>
            <p>
              Offers are organised across nine categories: <Link href="/?category=dining" className="text-teal-700 hover:underline">dining</Link>, <Link href="/?category=fuel" className="text-teal-700 hover:underline">fuel</Link>, <Link href="/?category=supermarket" className="text-teal-700 hover:underline">supermarket</Link>, <Link href="/?category=travel" className="text-teal-700 hover:underline">travel</Link>, <Link href="/?category=online" className="text-teal-700 hover:underline">online shopping</Link>, <Link href="/?category=installment" className="text-teal-700 hover:underline">installment plans</Link>, <Link href="/?category=cashback" className="text-teal-700 hover:underline">cashback</Link>, <Link href="/?category=bogo" className="text-teal-700 hover:underline">buy-one-get-one</Link>, and other promotions. Use the filters at the top of the page to narrow by bank, card type, or category.
            </p>
            <p>
              Each listing shows the validity period and a &ldquo;last checked&rdquo; date so you know how fresh the information is. Offer data is reviewed regularly and updated as banks publish new promotions or retire expired deals. SL Card Offers covers Visa, Mastercard, and American Express credit cards issued by Sri Lankan banks.
            </p>
            <p>
              Browse offers by bank: {banks.map((bank, i) => (
                <span key={bank.id}>
                  <Link href={`/banks/${bank.id}`} className="text-teal-700 hover:underline">{bank.shortName}</Link>
                  {i < banks.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="text-xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6 max-w-3xl">
            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-teal-700">
                Which Sri Lankan bank has the best credit card offers?
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Commercial Bank, Sampath Bank, and Seylan Bank regularly publish the most credit card offers across dining, fuel, and supermarket categories in Sri Lanka. The best bank depends on your spending habits — use SL Card Offers to filter and compare live deals from all {bankCount} tracked banks side by side.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-teal-700">
                How do I compare credit card offers in Sri Lanka?
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Visit SL Card Offers to browse {totalCount.toLocaleString()}+ active deals from {bankCount} Sri Lankan banks in one place. Filter by bank, card, or category (dining, fuel, travel, supermarket, cashback, and more) to find offers that match your lifestyle. Each listing links directly to the official bank page so you can verify terms before using an offer.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-teal-700">
                How often are the credit card offers updated?
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                SL Card Offers is updated regularly as banks publish new promotions. Each offer card shows a &ldquo;last checked&rdquo; date so you can see how recently the information was verified. Always confirm final terms at the official bank website before redeeming an offer.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-teal-700">
                Does SL Card Offers cover all Sri Lankan banks?
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                SL Card Offers currently tracks {bankCount} Sri Lankan banks including Commercial Bank, Sampath Bank, BOC, People&rsquo;s Bank, NDB, NTB, Seylan Bank, DFCC, Pan Asia Bank, Standard Chartered, Union Bank, and Cargills Bank. More banks are added as their offer data becomes available.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-teal-700">
                What categories of credit card offers are available?
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                SL Card Offers lists deals across nine categories: dining, fuel, supermarket, travel, online shopping, installment plans, cashback, buy-one-get-one (BOGO), and other promotions. Use the category filter on the homepage to narrow your search.
              </p>
            </details>
          </div>
        </div>
      </section> */}
    </main>
  );
}
