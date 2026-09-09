# Invest Italy

Build "Forecastalo", an investment-opportunity screening tool for Italy. This first iteration is ONLY the app skeleton plus the database schema — do not build any data fetching or forecasting logic yet.

LAYOUT
- Single page, two columns, full viewport height, no scrolling of the page itself (each column scrolls independently).
- Slim top bar: product name "Forecastalo" on the left, one-line tagline "Where to invest in housing and energy across Italy" next to it.
- Left column (~40% width): a control panel on top and a results panel below it.
  - Controls: three dropdowns and one primary button, laid out compactly.
    - "Investment play": options "Housing + Energy (PV + heat pump)" (selected by default), "EV Charging & Mobility" (disabled), "Energy Community" (disabled).
    - "Geography": options "Provinces — Italy" (default) and "Municipalities — Piemonte".
    - "Horizon": options "1 year", "3 years", "5 years".
    - Primary button labelled "Calculate".
  - Results panel: a system message line at the top (e.g. "Ready.") and below it a scrollable list of result cards. Each card shows: zone name, a total score badge, and a short recommendation line.
- Right column (~60% width): a large rounded placeholder box filling the column, light grey, centred label "Map". Do NOT add any map library yet — this is a placeholder only.

STYLE
- Light UI. White and light-grey surfaces, dark grey text, ONE accent colour used only to highlight high scores.
- Generous spacing, nothing cramped. Rounded corners everywhere: buttons, inputs, dropdowns, cards, panels, the map placeholder.
- Soft, subtle shadows. Minimal icons. No hero section, no marketing copy, no footer.
- Subtle fade-in animation when result cards appear.
- All UI text in English.

DATABASE
Set up the database with these tables. The design must make it easy to plug in many different data sources over time, so indicators are stored generically rather than as one column per source.

data_sources: id, code (text, unique), name, description, url, licence, granularity, update_frequency, is_active (boolean, default true), created_at
zones: id, zone_code (text, unique), name, level (text, either 'province' or 'municipality'), parent_zone_code (text, nullable), region (text), latitude (numeric), longitude (numeric), population (integer, nullable), created_at
indicators: id, zone_id (references zones), source_id (references data_sources), indicator_code (text), period (date), value (numeric), unit (text), created_at — add a unique constraint on (zone_id, indicator_code, period)
forecasts: id, zone_id (references zones), indicator_code (text), horizon_months (integer), period (date), value_forecast (numeric), lower_bound (numeric), upper_bound (numeric), model_version (text), created_at
scores: id, zone_id (references zones), play (text), score_total (numeric), breakdown (jsonb), recommendation (text), computed_at

Add indexes on indicators(zone_id, indicator_code) and scores(play, score_total).

Seed the data_sources table with exactly three rows:
1. code "pvgis", name "PVGIS (JRC)", description "Photovoltaic yield and solar radiation", url "https://re.jrc.ec.europa.eu", granularity "coordinate", update_frequency "static"
2. code "istat", name "ISTAT SDMX", description "Population, households, buildings and dwellings", url "https://esploradati.istat.it", granularity "municipality", update_frequency "annual"
3. code "siape", name "SIAPE ENEA", description "Energy performance certificates of buildings", url "https://siape.enea.it", granularity "province", update_frequency "annual"

Leave zones, indicators, forecasts and scores empty.

This is a public read-only demo: no authentication, no login screen, no sign-up. All tables should be publicly readable but not publicly writable.

Wire the "Calculate" button to query the scores table filtered by the selected play. Since there is no data yet, it must show a clean, friendly empty state in the results panel saying that no scores have been computed yet — not an error.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://investalo-italia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5b944868-d94e-47bb-b73c-49068702d529).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
