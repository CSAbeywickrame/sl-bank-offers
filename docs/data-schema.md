# Data schema

CardCompass stores its MVP catalog as a file-backed seed dataset at `data/seed.json`.

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

## Current fixture

`data/seed.json` now contains the initial curated MVP catalog:

- 5 Sri Lankan banks
- 6 card records covering generic and premium offer eligibility
- 12 active offers across dining, supermarket, travel, installment, and online categories

Every offer includes an official public `sourceUrl`, a `termsLink`, and a `lastReviewedAt`
capture timestamp so the catalog can track freshness from the first seed onward.
