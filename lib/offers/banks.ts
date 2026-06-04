import type { Bank } from "./types";

export const banks: Bank[] = [
  { id: "hnb", name: "Hatton National Bank", shortName: "HNB", websiteUrl: "https://www.hnb.net" },
  { id: "commercial-bank", name: "Commercial Bank of Ceylon", shortName: "Commercial Bank", websiteUrl: "https://www.combank.lk" },
  { id: "cdb", name: "Citizens Development Business Finance", shortName: "CDB", websiteUrl: "https://www.cdb.lk" },
  { id: "ndb", name: "National Development Bank", shortName: "NDB", websiteUrl: "https://www.ndbbank.com" },
  { id: "peoples-bank", name: "People's Bank", shortName: "People's Bank", websiteUrl: "https://www.peoplesbank.lk" },
  { id: "nsb", name: "National Savings Bank", shortName: "NSB", websiteUrl: "https://www.nsb.lk" },
  { id: "boc", name: "Bank of Ceylon", shortName: "BOC", websiteUrl: "https://www.boc.lk" },
  { id: "ntb", name: "Nations Trust Bank", shortName: "NTB", websiteUrl: "https://www.nationstrust.com" },
  { id: "sampath", name: "Sampath Bank", shortName: "Sampath", websiteUrl: "https://www.sampath.lk" },
  { id: "dfcc", name: "DFCC Bank", shortName: "DFCC", websiteUrl: "https://www.dfcc.lk" }
];

export function getBankById(bankId: string): Bank | undefined {
  return banks.find((bank) => bank.id === bankId);
}
