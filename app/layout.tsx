import type { Metadata } from "next";
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
      <body>
        {children}
        <WebAnalytics />
      </body>
    </html>
  );
}
