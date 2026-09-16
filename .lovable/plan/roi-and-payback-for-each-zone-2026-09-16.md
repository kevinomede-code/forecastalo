# ROI and payback for each zone

Add rough investment economics — CAPEX, annual revenue/savings, simple payback, ROI over the selected horizon — to the Screening page. No scoring changes, no SQL changes, no changes to the map, the chat or the other pages. All text in English.

## What the user sees

When a zone is clicked in the results list, an "Economics" block appears under the card area (above the spread chart for market zones):

- **CAPEX** — the assumed investment size
- **Annual revenue / savings**
- **Simple payback** — years, e.g. "7.4 years"
- **ROI over horizon** — net gain over 1 / 3 / 5 years as a percentage of CAPEX; follows the Horizon select already on the page
- A short footnote listing every assumption used, so nothing looks more precise than it is

Numbers that cannot be computed honestly are not shown; instead a one-line note says which input is missing (same style as the existing "not included" wording).

## Where the numbers come from

**Battery storage (market zones)** — live prices from the database:
- latest 30 days of `price_spread_eur_mwh` for that zone (average) = today's captured value
- the 90-day TimesFM forecast average = forward-looking case
- both shown: "recent actual" and "forecast-based" payback, so the reader sees the range
- assumed system: 2 MWh / 2 h, 1 cycle per day, 88% round-trip efficiency, 50% spread capture, CAPEX 250 €/kWh = 500,000 €

**Housing + Energy (provinces / municipalities)** — PV yield from the zone's stored breakdown:
- annual production = 6 kWp × `pv_yield_kwh_per_kwp`
- savings = production × 60% self-consumption × 0.30 €/kWh retail tariff (stated constant, as agreed)
- CAPEX = 6 kWp × 1,800 €/kWp = 10,800 €
- heat pump is not modelled — no heating-demand data in the database yet; stated in the footnote

ROI over horizon = (annual figure × horizon years − CAPEX) / CAPEX. No discounting, no degradation, no O&M — deliberately simple and labelled as such.

## Technical notes

- New pure module `src/lib/economics.ts`: assumption constants plus `housingEconomics(breakdown)` and `batteryEconomics({ recentSpread, forecastSpread })`, both returning `{ capex, annual, paybackYears, roiPct, missing }`. Unit-testable, no I/O.
- New `src/components/ZoneEconomics.tsx`: metric tiles + assumptions footnote, existing tokens and card styling.
- `src/routes/screening.tsx`: render `ZoneEconomics` for the selected row, passing `horizon` and the play. For market zones it needs the recent/forecast spread averages — reuse the query key already used by `SpreadChart` (`["spread-chart", zoneId]`) so no extra request is made; extract that fetch into a small shared hook consumed by both components.
- Housing PV yield is read from the existing `breakdown` JSON (the `solar` factor's raw value); if the factor is absent, the block reports the missing input instead of guessing.
- Untouched: `score-types.ts` scoring, all SQL functions, map, chat, `/graph`, `/system`.

## Verification

- `bunx tsgo --noEmit` and production build
- Playwright: Housing play → click a province → payback and ROI shown, ROI changes when the horizon changes; Battery play → click a market zone → both actual and forecast payback shown alongside the spread chart; no console errors and no extra network requests beyond the existing spread query
