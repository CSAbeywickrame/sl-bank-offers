import type { OfferCategory } from "@/lib/offers/types";

const CATEGORY_RULES: Array<{ category: OfferCategory; patterns: RegExp[] }> = [
  {
    category: "travel",
    patterns: [/\b(travel|airline|airlines|flight|flights|airport|tour|tours|holiday|holidays|vacation|vacations)\b/i]
  },
  {
    category: "hotels",
    patterns: [/\b(hotel|hotels|resort|resorts|stay|stays|accommodation|lodging)\b/i]
  },
  {
    category: "supermarkets",
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
    category: "health",
    patterns: [/\b(health|medical|medicine|pharmacy|pharmacies|hospital|hospitals|clinic|clinics|wellness|dental|doctor|doctors)\b/i]
  },
  {
    category: "education",
    patterns: [/\b(education|school|schools|college|colleges|university|universities|tuition|course|courses|learning|academic)\b/i]
  },
  {
    category: "shopping",
    patterns: [/\b(shopping|shop|stores?|retail|mall|malls|apparel|fashion|electronics)\b/i]
  },
  {
    category: "online",
    patterns: [/\b(online|internet|web|website|e-commerce|ecommerce|digital|app|apps|mobile)\b/i]
  },
  {
    category: "entertainment",
    patterns: [/\b(entertainment|movie|movies|cinema|theater|theatre|concert|concerts|music|gaming|game|games|show|shows)\b/i]
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
