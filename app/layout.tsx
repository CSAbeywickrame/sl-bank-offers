import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WebAnalytics } from "@/components/WebAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sri Lankan Bank Card Offers",
  description: "Browse Sri Lankan credit card offers by bank and category.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <WebAnalytics />
      </body>
    </html>
  );
}
