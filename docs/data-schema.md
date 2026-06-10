# Data schema

CardCompass stores its MVP catalog as a file-backed seed dataset at `data/seed.json`.
Commercial Bank scrape handoffs are normalized separately at `data/scanned-offers.json` before they are synced into the seed.

## Entities

### `Bank`

- `id`: stable slug used in routes and relationships
- `name`: full bank name
- `shortName`: compact display label
- `websiteUrl`: canonical bank homepage

### `Card`

- `id`: stable slug for the card
- `bankId`: parent `Bank.id`
- `name`: customer-facing card name
- `network`: optional scheme such as Visa or Mastercard
- `tier`: optional card tier such as Signature or Platinum

### `Offer`

- `id`: stable slug for the offer
- `cardId`: parent `Card.id`
- `title`: short display title
- `category`: one of `dining`, `fuel`, `supermarket`, `travel`, `online`, `installment`, `cashback`, `bogo`, `other`
- `description`: user-facing summary
- `merchant`: optional merchant or merchant group
- `location`: optional geographic scope
- `validFrom`: optional ISO date
- `validUntil`: optional ISO date
- `termsLink`: official bank terms/promotions link
- `sourceUrl`: canonical offer source URL
- `lastReviewedAt`: ISO timestamp for the latest manual/source verification
- `status`: `active`, `inactive`, `expired`, or `needs_review`

### `ScannedOffer`

This is the handoff contract for Scout and any future scraper output. Each record in `data/scanned-offers.json` must populate:

- `id`: stable slug for the offer
- `bankId`: parent bank slug
- `cardId`: parent card slug already present in `data/seed.json`
- `title`: short display title
- `category`: one of `dining`, `fuel`, `supermarket`, `travel`, `online`, `installment`, `cashback`, `bogo`, `other`
- `description`: cleaned user-facing summary
- `merchant`: optional merchant or merchant group
- `location`: optional geographic scope
- `validFrom`: optional ISO date
- `validUntil`: optional ISO date
- `termsLink`: official bank terms or campaign page
- `sourceUrl`: canonical scraped source URL
- `lastReviewedAt`: ISO timestamp for the scrape/manual verification time
- `status`: `active`, `inactive`, `expired`, or `needs_review`

The tracked catalog wrapper is:

```json
{
  "version": 1,
  "updatedAt": "2026-06-10T00:00:00.000Z",
  "offers": []
}
```

## Seed format

The canonical file shape is:

```json
{
  "banks": [],
  "cards": [],
  "offers": []
}
```

The repository projects that normalized seed into the flatter UI offer shape used by the browse experience, so the UI can still filter by bank/category while the stored source of truth remains relational.

To apply the tracked scrape handoff into the app catalog, run:

```bash
npm run sync:scanned
```

That sync upserts the scanned offers by `id` and leaves unrelated seed records untouched.

## Current fixture

`data/seed.json` now contains the initial curated MVP catalog:

- 5 Sri Lankan banks
- 8 card records covering generic and premium offer eligibility
- 41 active offers across dining, supermarket, travel, installment, and online categories

Every offer includes an official public `sourceUrl`, a `termsLink`, and a `lastReviewedAt`
capture timestamp so the catalog can track freshness from the first seed onward.
