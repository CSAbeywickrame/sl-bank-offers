# Bank Offers Automated Directory Design

Date: June 4, 2026
Project folder: `Bank-Offers`
Status: Approved for implementation planning

## Purpose

Bank Offers is a standalone public directory that collects Sri Lankan bank credit card offers into one convenient place. Users should be able to browse a combined offer feed, filter by bank and category, and open the original bank source for confirmation.

The first version will be fully automated. If source quality proves inconsistent, the system should be able to add a manual review workflow later without changing the public data model.

## Target Users

- Credit card holders who want to find current offers across several Sri Lankan banks without checking each bank website separately.
- Users comparing offers by category, such as dining, hotels, travel, shopping, health, and supermarkets.
- Users who still want to verify details from the official bank page before using an offer.

## Scope

### In Scope

- Create a new standalone app inside `Bank-Offers`.
- Collect offer data from Sri Lankan bank offer pages.
- Start with banks including HNB, Commercial Bank of Ceylon, CDB, NDB, People's Bank, NSB, BOC, NTB, Sampath Bank, and DFCC.
- Keep the source registry extensible for other banks such as Seylan, Union Bank, Pan Asia, Amana, HSBC, and Standard Chartered.
- Normalize scraped data into one shared offer format.
- Automatically categorize offers.
- Show a combined offers page with filters for bank and category.
- Show bank-specific and category-specific views.
- Display the original bank link on each offer.
- Display freshness signals, including last checked date and detected expiry date where available.
- Run a scheduled refresh job.
- Mark disappeared or expired offers inactive instead of deleting them immediately.

### Out of Scope For MVP

- User accounts.
- Personalized recommendations.
- Browser extension or mobile app.
- Manual review dashboard.
- Payment, subscriptions, or BizTool tenant integration.
- Guaranteeing offer validity beyond linking users to the official bank source.

## Product Experience

### Combined Offers Page

The home page is the main discovery surface. It should show all currently active offers in a searchable, filterable directory.

Users must be able to filter by:

- Bank: HNB, Commercial Bank, CDB, NDB, People's Bank, NSB, BOC, NTB, Sampath, DFCC, and any future banks.
- Category: Dining, Travel, Hotels, Shopping, Supermarkets, Fuel, Health, Education, Online, Entertainment, and Other.
- Search text: title, merchant, bank, short description, and category.

The page should support selecting any bank and any category. The MVP can use single-select filters if that keeps delivery simple, but the component design should allow multi-select filters later.

Each offer card should show:

- Bank name.
- Category.
- Offer title.
- Merchant or location when detected.
- Short description.
- Valid until date when detected.
- Last checked date.
- Source link button labeled with a clear action such as "View at bank".

### Bank Pages

Each bank page should show active offers for that bank and keep the same category filter pattern as the combined page.

Example routes:

- `/banks/hnb`
- `/banks/dfcc`
- `/banks/sampath`

### Category Pages

Each category page should show offers across all banks for that category and keep the same bank filter pattern as the combined page.

Example routes:

- `/categories/dining`
- `/categories/travel`
- `/categories/hotels`

## Data Model

Each normalized offer should include:

- `id`: stable identifier generated from bank, title, source URL, merchant, and offer dates.
- `bankId`: normalized bank key.
- `bankName`: display name.
- `title`: offer title.
- `category`: normalized category.
- `description`: short extracted or generated summary.
- `merchant`: merchant or partner name when available.
- `location`: location or islandwide indicator when available.
- `cardType`: card type or scheme when available.
- `validFrom`: start date when available.
- `validUntil`: expiry date when available.
- `terms`: concise terms or conditions when safely extracted.
- `sourceUrl`: official bank URL.
- `imageUrl`: source image when useful and legally safe to display.
- `firstSeenAt`: first collection timestamp.
- `lastSeenAt`: most recent collection timestamp.
- `lastCheckedAt`: most recent source check timestamp.
- `status`: `auto_published`, `inactive`, `expired`, or `needs_review`.
- `rawSourceHash`: hash of source content used for change detection.

## Source Registry

Each bank source should be defined in configuration rather than hard-coded throughout the scraper.

Each source config should include:

- Bank ID and display name.
- Offer page URL or URLs.
- Source type: static HTML, dynamic page, RSS-like feed, PDF/image-heavy page, or unknown.
- Parser strategy.
- Default category hints if the bank separates offers by page.
- Enabled flag.

This design lets the app add or disable banks without changing the UI.

## Ingestion Flow

1. Load enabled bank source configs.
2. Fetch each bank's offer pages.
3. Extract candidate offers from page structure, metadata, links, and visible text.
4. Normalize each candidate into the shared offer format.
5. Categorize each offer using keyword and source-page rules.
6. Generate stable IDs and compare with existing stored offers.
7. Add new offers, update changed offers, and refresh `lastSeenAt`.
8. Mark offers inactive if they disappear from the source for repeated refreshes.
9. Mark offers expired when `validUntil` is confidently in the past.
10. Save the updated offer dataset.

## Categorization Rules

The MVP should use deterministic rules first:

- Dining: restaurant, cafe, coffee, buffet, food, delivery.
- Travel: airline, airport, booking, tour, cruise, transport.
- Hotels: hotel, resort, villa, stay, room, accommodation.
- Shopping: fashion, electronics, department store, retail.
- Supermarkets: supermarket, grocery, hypermarket.
- Fuel: fuel, petrol, diesel, charging station.
- Health: hospital, pharmacy, clinic, medical, optical.
- Education: school, university, course, institute, academy.
- Online: online, ecommerce, marketplace, app, website.
- Entertainment: cinema, movie, event, theme park.

If no category is clear, use `Other`. The system should prefer `Other` over a forced incorrect category.

## Automation

The scheduled refresh should run daily. The job should produce a readable run summary:

- Banks checked.
- Offers added.
- Offers updated.
- Offers marked inactive.
- Offers marked expired.
- Source failures.

Failures for one bank must not stop the entire refresh. The app should keep displaying the most recent successfully collected data and show `lastCheckedAt` per offer.

## Data Trust And User Safety

The app is not the official issuer of offers. The public UI should make that clear through behavior rather than long disclaimers:

- Every offer must include an official source link.
- Expiry and last checked dates must be visible.
- Offers without confident expiry dates should not invent one.
- Bank pages that fail during refresh should retain prior data but should not show a false fresh timestamp.

## Technical Direction

Use a standalone Next.js app for the MVP:

- `app/`: routes and UI.
- `components/`: offer cards, filters, bank/category navigation, status badges.
- `lib/sources/`: bank source registry.
- `lib/ingest/`: fetch, parse, normalize, categorize, dedupe, persist.
- `data/`: local offer dataset for MVP.
- `scripts/refresh-offers.ts`: scheduled refresh entry point.

For MVP storage, use a local JSON file or SQLite. JSON is fastest for a prototype; SQLite is better if filtering, history, and admin review are expected soon. The implementation plan should choose one based on the selected framework setup.

## Error Handling

- Treat each bank source as independently recoverable.
- Save partial successful results when some banks fail.
- Record source errors in a refresh log.
- Do not delete offers immediately when a source fails.
- Use inactive or expired status for offers that should no longer appear by default.

## Testing And Verification

The MVP should verify:

- Category filters work on the combined page.
- Bank filters work on the combined page.
- Search works with bank/category filters.
- Bank pages only show matching bank offers.
- Category pages only show matching category offers.
- Offer cards always show source links.
- The ingestion script can handle at least one successful source and one failing source in the same run.
- Duplicate offers from the same source are not repeatedly added.

## Future Review Fallback

If automated extraction is inconsistent, add an admin review mode using the existing `status` field:

- New uncertain offers can become `needs_review`.
- Reviewed offers can become `auto_published`.
- Rejected offers can become `inactive`.

This should be added only after the first automated version reveals real source quality issues.
