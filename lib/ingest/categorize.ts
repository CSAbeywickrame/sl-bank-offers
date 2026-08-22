import type { OfferCategory } from "@/lib/offers/types";

/**
 * Rule-based vertical assignment for the feed banks, which never reach the extraction model.
 *
 * Only the merchant's vertical is decided here. How an offer pays out (installment, cashback,
 * BOGO) is `offerType`, parsed separately in lib/ingest/enrich.ts — an interest-free plan at a
 * furniture shop is `home`, not a category of its own.
 *
 * Order is the whole design: first match wins, so the more specific vertical has to be listed
 * before the broader one it would otherwise be swallowed by.
 */
const CATEGORY_RULES: Array<{ category: OfferCategory; pattern: RegExp }> = [
  // Dining outranks hotels deliberately: a hotel's restaurant, bar or buffet is a meal out, and
  // that is what a shopper browsing Dining is looking for.
  {
    category: "dining",
    pattern:
      /\b(dining|dine|restaurant|restaurants|cafe|cafes|coffee|bar|bars|pub|pubs|bakery|bakeries|eatery|buffet|buffets|brunch|lunch|dinner|breakfast|high tea|meal|meals|cuisine|food delivery|takeaway)\b/i
  },
  // Staying somewhere.
  {
    category: "hotels",
    pattern: /\b(hotel|hotels|resort|resorts|villa|villas|bungalow|chalet|guesthouse|stay|stays|accommodation|lodging|room rate|half board|full board|bed and breakfast)\b/i
  },
  // Getting there.
  {
    category: "travel",
    pattern: /\b(travel|airline|airlines|flight|flights|airfare|airport|lounge|tour|tours|holiday|holidays|vacation|vacations|cruise|cruises|visa|passport|duty free|travel agent)\b/i
  },
  {
    category: "supermarket",
    pattern: /\b(supermarket|supermarkets|grocery|groceries|hypermarket|keells|cargills|arpico|glomark|spar)\b/i
  },
  { category: "fuel", pattern: /\b(fuel|petrol|gasoline|diesel|gas station|filling station)\b/i },
  {
    category: "health",
    pattern:
      /\b(hospital|hospitals|clinic|clinics|pharmacy|pharmacies|medical|dental|dentist|laboratory|laboratories|channelling|optician|opticians|eyewear|spectacles|spa|spas|salon|salons|gym|gyms|fitness|wellness|surgery|healthcare)\b/i
  },
  {
    category: "electronics",
    pattern:
      /\b(electronic|electronics|mobile phone|smartphone|laptop|laptops|computer|computers|television|tv|camera|cameras|refrigerator|washing machine|air conditioner|appliance|appliances|gadget|gadgets)\b/i
  },
  {
    category: "fashion",
    pattern:
      /\b(fashion|clothing|clothes|apparel|footwear|shoe|shoes|handbag|handbags|jewellery|jewelry|watch|watches|textile|textiles|tailoring|boutique|garment|garments|accessories)\b/i
  },
  {
    category: "home",
    pattern:
      /\b(furniture|homeware|kitchenware|mattress|mattresses|bedding|curtain|curtains|lighting|hardware|paint|paints|tile|tiles|bathware|sanitary|home improvement|construction material|cement|interior)\b/i
  },
  {
    category: "automotive",
    pattern: /\b(vehicle|vehicles|automobile|automotive|car service|spare parts?|tyre|tyres|tire|tires|battery|batteries|lubricant|lubricants|car care|motor)\b/i
  },
  {
    category: "leisure",
    pattern:
      /\b(cinema|cinemas|movie|movies|theatre|amusement|water park|theme park|gaming|arcade|concert|event|events|sport|sports|toy|toys|book|books|stationery|kids)\b/i
  },
  // Last: "online" describes how you buy, not what you buy, so it only wins when nothing above did.
  { category: "online", pattern: /\b(online|e-commerce|ecommerce|website|web store|marketplace|app)\b/i }
];

export function categorizeOfferText(text: string): OfferCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }
  return "other";
}
