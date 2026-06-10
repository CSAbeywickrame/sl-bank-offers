# Data schema

CardCompass stores its MVP catalog as a file-backed seed dataset at `data/seed.json`.
Tracked scrape handoffs are normalized separately at `data/scanned-offers.json` before they are synced into the seed.

Raw scrape snapshots that must survive beyond a single working session belong in `data/` with a dated filename such as `data/peoplesbank-scrape-2026-06-10.json`.
Scratch scrape inputs, HTML saves, and one-off parsing experiments belong in `tmp/` only while a scrape is in progress and must be deleted once the durable handoff files in `data/` are produced and verified.

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

Handoff workflow:

1. Save the durable raw scrape snapshot in `data/` with a bank/date-specific filename.
2. Normalize the scrape into `data/scanned-offers.json`.
3. Run `npm run sync:scanned` to update `data/seed.json`.
4. Remove any temporary scrape working files under `tmp/` before closing the task.

## Current fixture

`data/seed.json` currently contains the tracked MVP catalog:

- 5 Sri Lankan banks
- 9 card records covering generic, premium, and private-banking offer eligibility
- 368 active offers across dining, supermarket, travel, installment, online, and other categories

Every offer includes an official public `sourceUrl`, a `termsLink`, and a `lastReviewedAt`
capture timestamp so the catalog can track freshness from the first seed onward.
