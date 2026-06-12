import type { SourceType } from "@/lib/offers/types";

export interface BankSource {
  bankId: string;
  bankName: string;
  shortName: string;
  enabled: boolean;
  sourceType: SourceType;
  urls: string[];
}

export const bankSources: BankSource[] = [
  {
    bankId: "hnb",
    bankName: "Hatton National Bank",
    shortName: "HNB",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.hnb.lk/personal/promotions/card-promotion/card-offers"]
  },
  {
    bankId: "commercial-bank",
    bankName: "Commercial Bank of Ceylon",
    shortName: "Commercial Bank",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.combank.lk/rewards-promotions"]
  },
  {
    bankId: "cdb",
    bankName: "Citizens Development Business Finance",
    shortName: "CDB",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.cdb.lk/cdb-offers"]
  },
  {
    bankId: "ndb",
    bankName: "National Development Bank",
    shortName: "NDB",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.ndbbank.com/cards/card-offers"]
  },
  {
    bankId: "peoples-bank",
    bankName: "People's Bank",
    shortName: "People's Bank",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.peoplesbank.lk/special-offers/"]
  },
  {
    bankId: "nsb",
    bankName: "National Savings Bank",
    shortName: "NSB",
    enabled: true,
    sourceType: "pdf_or_image",
    urls: ["https://www.nsb.lk/wp-content/uploads/2018/05/NSB-Mastercard-Offers-International.pdf"]
  },
  {
    bankId: "boc",
    bankName: "Bank of Ceylon",
    shortName: "BOC",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.boc.lk/personal-banking/card-offers"]
  },
  {
    bankId: "ntb",
    bankName: "Nations Trust Bank",
    shortName: "NTB",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.nationstrust.com/promotions"]
  },
  {
    bankId: "cargills-bank",
    bankName: "Cargills Bank",
    shortName: "Cargills Bank",
    enabled: true,
    sourceType: "static_html",
    urls: [
      "https://www.cargillsbank.com/products/cargills-bank-cards-promotions/",
      "https://www.cargillsbank.com/products/mastercard-promotions/"
    ]
  },
  {
    bankId: "standard-chartered",
    bankName: "Standard Chartered Sri Lanka",
    shortName: "Standard Chartered",
    enabled: true,
    sourceType: "feed",
    urls: ["https://www.sc.com/lk/data/tgl/offers.json"]
  },
  {
    bankId: "sampath",
    bankName: "Sampath Bank",
    shortName: "Sampath",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.sampath.lk/sampath-cards/credit-card-offer"]
  },
  {
    bankId: "dfcc",
    bankName: "DFCC Bank",
    shortName: "DFCC",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.dfcc.lk/cards/card-offers"]
  },
  {
    bankId: "seylan",
    bankName: "Seylan Bank",
    shortName: "Seylan",
    enabled: true,
    sourceType: "static_html",
    urls: ["https://www.seylan.lk/personal-banking/card-offers"]
  }
];
