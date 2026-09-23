# Solar revenue page

## Build
- Add `/solar` as a single-column page using the existing System page shell and visual tokens.
- Load the seven market zones and each selected zone’s monthly capture-rate history plus 90-day TimesFM forecast directly from the existing database.
- Add the capture-rate chart, exact yearly comparison table, methodology, investment-impact, and forecast-quality copy supplied.
- Add “Solar revenue” to the sidebar between Screening and Knowledge.

## Smaller updates
- Add the capture-rate source and limitation to the System page.
- Add the supplied `solar_capture_rate` definition and validation facts to the chat’s system guidance.

## Technical details
- Reuse Recharts conventions from the existing spread chart, including the existing line/band colors and tooltip treatment.
- Keep the selected-zone query client-side and read-only; no SQL, scoring, Screening, or Knowledge changes.
- Add unique `/solar` page metadata, then verify build health and the page at desktop and mobile widths.
