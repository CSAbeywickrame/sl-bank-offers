import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { WebAnalytics } from "@/components/WebAnalytics";
import { getBanks } from "@/lib/offers/banks";
import { buildSiteDescription } from "@/lib/seo-copy";
import { siteName, siteTitle, siteUrl } from "@/lib/site-config";
import "./globals.css";

// Self-hosted at build time by next/font, so there is no render-blocking request to
// fonts.googleapis.com. The design system's --font-sans token points at this variable.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

// Derived per request so the bank count in the description follows the data.
export function generateMetadata(): Metadata {
  const siteDescription = buildSiteDescription(getBanks().length);
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteTitle,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    openGraph: {
      type: "website",
      locale: "en_LK",
      siteName,
      title: siteTitle,
      description: siteDescription,
      url: siteUrl,
    },
    twitter: {
      card: "summary",
      title: siteTitle,
      description: siteDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    icons: {
      icon: [{ url: "/icon.png", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
      shortcut: ["/icon.png"],
    },
    alternates: {
      canonical: siteUrl,
    },
  };
}

// Built inside the component so the description tracks the same bank count as the metadata.
const buildWebsiteJsonLd = (siteDescription: string) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      description: siteDescription,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: siteDescription,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-LK",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={hankenGrotesk.variable}>
      <body className="flex min-h-screen flex-col">
        <JsonLd data={buildWebsiteJsonLd(buildSiteDescription(getBanks().length))} />
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <WebAnalytics />
      </body>
    </html>
  );
}
