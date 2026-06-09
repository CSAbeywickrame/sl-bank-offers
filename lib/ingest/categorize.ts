import type { OfferCategory } from "@/lib/offers/types";

const CATEGORY_RULES: Array<{ category: OfferCategory; patterns: RegExp[] }> = [
  {
    category: "travel",
    patterns: [/\b(travel|airline|airlines|flight|flights|airport|tour|tours|holiday|holidays|vacation|vacations|hotel|hotels|resort|resorts|stay|stays|accommodation|lodging)\b/i]
  },
  {
    category: "installment",
    patterns: [/\b(installment|installments|instalment|instalments|easy payment|easy pay|0% interest|monthly plan|pay later)\b/i]
  },
  {
    category: "cashback",
    patterns: [/\b(cashback|cash back|rebate|money back)\b/i]
  },
  {
    category: "bogo",
    patterns: [/\b(bogo|buy one get one|buy 1 get 1|two for one|2 for 1)\b/i]
  },
  {
    category: "supermarket",
    patterns: [/\b(supermarket|supermarkets|grocery|groceries|grocery store|hypermarket)\b/i]
  },
  {
    category: "dining",
    patterns: [/\b(dining|restaurant|restaurants|cafe|cafes|eatery|food|meal|meals|cuisine)\b/i]
  },
  {
    category: "fuel",
    patterns: [/\b(fuel|petrol|gasoline|gas station|diesel|pump)\b/i]
  },
  {
    category: "online",
    patterns: [/\b(online|internet|web|website|e-commerce|ecommerce|digital|app|apps|mobile)\b/i]
  }
];

export function categorizeOfferText(text: string): OfferCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return "other";
}
