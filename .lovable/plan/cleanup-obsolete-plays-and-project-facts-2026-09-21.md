# Cleanup obsolete plays and project facts

## Changes
- Remove the two permanently disabled investment plays and the now-unused disabled option handling from Screening.
- Correct the chat grounding prompt with the supplied municipality threshold, horizon-dependent weights, ten-window validation results, and SIAPE status.
- Update the System page’s scored-zone counter, SIAPE source status, and municipality/building-stock limitation using the exact supplied wording and figures.

## Scope
Only `src/routes/screening.tsx`, `src/lib/ask.functions.ts`, and `src/routes/system.tsx` will change. Styling, scoring code, database queries, and all other routes remain untouched.

## Verification
Run the TypeScript check, confirm the generated app build is healthy, and inspect the three edited passages for exact wording and figures.
