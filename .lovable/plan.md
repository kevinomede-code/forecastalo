# Zone comparison + rough economics on Screening

Two features on `/screening` only. No scoring logic, no SQL, no other route changes (except a tiny prefill hook in the chat home so users can ask about a comparison). All UI text in English, existing light styling and tokens.

## 1. Zone comparison (shortlist)

- Select up to 4 zones: a small "＋ Compare" button on each result card (and the same action in the map popup row for already-selected zones is not added — selection is via cards only).
- A compact tray appears above the results list when at least one zone is selected: chips with zone name + remove ×, and a primary "Compare (3)" button (disabled until 2+).
- "Compare" opens an overlay panel covering the right (map) column: one column per zone, side by side:
  - zone name, level, region (from zone data), recomputed horizon score badge
  - the factor table already used by `BreakdownList` (reused as-is, with active horizon weights)
  - one-line recommendation
  - key stats row: population (added to the query select), and for market zones the latest historical spread
  - for market zones, the existing `SpreadChart` inline
  - "Ask about these zones" button → navigates to `/?ask=<prefilled question>` (e.g. "Compare Torino, Milano and Genova for housing + energy over 3 years. Which is best and why?")
- Selection resets when play/geography changes. Close button returns to the map.

## 2. Economic numbers (rough, stated assumptions)

New pure module `src/lib/economics.ts` — client-side only, no new DB queries, all inputs from the row's `breakdown` + zone data. Every assumption is a named constant and is rendered as a footnote under the numbers.

- **housing_energy** (rooftop PV, typical 6 kWp system):
  - annual yield = 6 × `pv_yield_kwh_per_kwp` (the `solar` factor value, already in breakdown)
  - savings = yield × self-consumption 60% × assumed retail tariff 0.30 €/kWh
  - CAPEX = 6 × 1,800 €/kWp → simple payback years, 5-year net
- **battery_storage** (arbitrage, typical 2 MWh / 2h battery):
  - daily captured spread = forecast spread (the `forecast_spread` factor value) × capture 50% × round-trip efficiency 88%
  - revenue = captured spread × 1 cycle/day × 365; CAPEX = 2,000 kWh × 250 €/kWh
  - simple payback years, 5-year revenue; when the zone has the latest actual `price_spread_eur_mwh` from the SpreadChart query, show both "forecast-based" and "last-month actual" payback
- Metrics that cannot be computed honestly are omitted with a short note (e.g. heat-pump savings are not modeled — no heating-demand data in the database; this joins the card's existing "Not included" block style).

New component `src/components/ZoneEconomics.tsx`: renders 3–4 metric tiles (CAPEX, annual revenue/savings, payback, 5-year) plus the assumptions footnote. Shown in two places:
1. Each column of the compare panel.
2. When a card is clicked (existing selection), a compact economics strip inside the `SpreadChart` area for market zones — for province/municipality plays, economics appear in the compare panel only, to keep the list view unchanged.

## 3. Chat prefill (`/?ask=`)

- `src/routes/index.tsx`: extend `validateSearch` with an optional `ask` string; on load, if `ask` is present, prefill the input (or auto-send on the empty state) and strip the param from the URL. No backend changes.

## Files

- New: `src/lib/economics.ts`, `src/components/ZoneEconomics.tsx`, `src/components/ComparePanel.tsx` (includes the tray)
- Modified: `src/routes/screening.tsx` (population in select, selection state, tray, overlay, economics where applicable), `src/routes/index.tsx` (`ask` search param + prefill)
- Untouched: map, scoring, SQL, other routes

## Verification

- `bunx tsgo --noEmit`, production build
- Playwright: calculate → select 3 zones → compare panel shows side-by-side factors + economics; "Ask about these zones" lands in chat with the question prefilled and sent; no console errors
