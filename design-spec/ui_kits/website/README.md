# SL Card Offers — Website UI Kit

Interactive, high-fidelity recreation of the SL Card Offers consumer site, composed entirely from this design system's components and the bundled tokens.

## Run
Open `index.html` (it loads `_ds_bundle.js`, `data.js`, then `app.js`).

## Surfaces
- **Homepage** — dark `Hero` band with live stats, sticky `Header`, `FilterBar` (Bank / Category / Search), a leaderboard `AdSlot` (planned monetisation), and a responsive grid of `OfferCard`s.
- **Offer detail** — dark offer header, two-column details + official-links sidebar.
- **Browse banks** — `BankCard` directory; clicking a bank filters the homepage.
- **Saved offers** *(logged-in)* — sign in via the modal to save offers (heart toggle on each card), see a Saved tab and a saved-only grid with its own empty state.
- **Sign-in modal** — entry point for the planned logged-in ecosystem.

## Files
- `index.html` — mount + script tags
- `data.js` — sample offers / banks / categories (from the real scraped set)
- `app.js` — screens, routing and interaction state (JSX, transpiled in-browser via Babel; kept as `.js` so it stays out of the component bundle)

Everything is cosmetic/mock — no real data fetching. Replace `data.js` with live offer data to make it real.
