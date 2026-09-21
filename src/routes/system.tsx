import { createFileRoute, Link } from "@tanstack/react-router";
import AppSidebar from "@/components/AppSidebar";

export const Route = createFileRoute("/system")({
  head: () => ({
    meta: [
      { title: "System — How Forecastalo Is Built" },
      {
        name: "description",
        content:
          "The architecture behind Forecastalo: open Italian data on Modal, Postgres storage, TimesFM 3.0 price forecasting and a grounded chat.",
      },
      { property: "og:title", content: "Forecastalo System" },
      {
        property: "og:description",
        content:
          "Pipeline, models and honest limits: how Forecastalo scores Italian territory for housing and battery investment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemPage,
});

const COUNTERS = [
  { value: "944", label: "zones scored" },
  { value: "188,917", label: "indicator rows" },
  { value: "3,896", label: "days of prices" },
  { value: "1,890", label: "forecasts" },
];

const BACKTEST: Array<{ window: string; spread: string; cells: string[]; best: number; strong?: boolean }> = [
  { window: "2026-06 → 08", spread: "108", cells: ["35.9", "55.5", "45.4", "43.1", "38.4"], best: 0 },
  { window: "2025-12 → 03", spread: "53", cells: ["20.4", "26.3", "33.8", "19.8", "36.1"], best: 3 },
  { window: "2025-06 → 09", spread: "79", cells: ["21.9", "49.7", "33.8", "40.9", "25.9"], best: 0 },
  { window: "2024-12 → 03", spread: "74", cells: ["21.9", "65.7", "27.7", "21.8", "25.5"], best: 3 },
  { window: "2024-06 → 09", spread: "94", cells: ["31.1", "38.7", "34.9", "26.2", "28.4"], best: 3 },
  { window: "2023-06 → 09", spread: "76", cells: ["21.2", "33.4", "142.2", "22.5", "90.9"], best: 0 },
  { window: "2022-06 → 09", spread: "224", cells: ["109.9", "81.4", "176.0", "112.9", "122.9"], best: 1 },
  { window: "2021-06 → 09", spread: "50", cells: ["15.2", "17.8", "23.4", "16.6", "17.0"], best: 0 },
  { window: "2020-05 → 08", spread: "26", cells: ["7.4", "11.2", "12.3", "7.6", "10.1"], best: 0 },
  { window: "2019-04 → 07", spread: "34", cells: ["9.1", "24.0", "14.3", "11.4", "10.3"], best: 0 },
  { window: "average", spread: "—", cells: ["29.4", "40.4", "54.4", "32.3", "40.5"], best: 0, strong: true },
  { window: "relative error", spread: "—", cells: ["32%", "52%", "63%", "36%", "48%"], best: 0, strong: true },
];

const SOURCES: Array<[string, string, string]> = [
  ["PVGIS (JRC)", "Photovoltaic yield and irradiation", "In use — open, no key"],
  ["ISTAT SDMX", "Population 2001–2026", "In use — open, no key"],
  ["ISTAT permanent census", "Dwellings by construction period", "In use — province level only"],
  ["GME", "Hourly zonal prices, 2016–2026, gap-free", "In use — manual download"],
  ["ENTSO-E", "Day-ahead prices", "In use — API token active"],
  ["SIAPE (ENEA)", "Energy performance certificates", "Inactive — no public API, zero rows"],
  ["OMI (Agenzia delle Entrate)", "Property prices", "Excluded — licence not open"],
  ["GSE Atlaimpianti", "Installed PV", "Portal offline"],
  ["Terna", "Grid and connection queues", "To evaluate"],
];

const LIMITS = [
  "The battery score contains no grid connection data, no local PV saturation and no permitting or land cost — and those decide whether a site is actually buildable. It is a filter on which market zone to study, not a site recommendation.",
  "The model does not beat a naive forecast on the price level — only on the intraday shape. Any use of these numbers should lean on the ranking between zones, not on the absolute spread value.",
  "Electricity prices are set per market zone. There are only 7. There is no sub-zonal precision, and any map suggesting otherwise would be false precision.",
  "Building stock exists only at province level, so it is the same value for every municipality in a province — a quarter of the municipal score carries no municipal information, and the breakdown flags it with province_level. Municipalities under 500 residents are not scored at all: below that size the ten-year population change is small-number noise, not a trend.",
  "The scoring weights are working assumptions, not a calibrated model — no investment return data exists to tune them against. The Horizon control shifts those weights on an argument, not on evidence: at 1 year the 90-day spread forecast carries 65% of the battery score, at 5 years only 35%, because a point forecast that far out is not worth trusting.",
  "Nothing here is investment advice.",
];

const KEY_TERMS: Array<[string, string]> = [
  ["Bidding zone", "One of the 7 areas where Italy forms its electricity price. Current layout since 1 January 2021, when Calabria was split off from South."],
  ["Day-ahead market (MGP)", "The auction where energy for the following day is traded hour by hour. Every price in this project comes from it."],
  ["Spread", "Daily maximum minus daily minimum price. The gross revenue of one battery charge-discharge cycle."],
  ["Zero-shot forecasting", "The model predicts a series it was never trained on. There is no training step in this codebase."],
  ["Context and horizon", "How many past points the model is given (1,024 days) and how many future ones it is asked for (90 days)."],
  ["Quantiles", "Not a single predicted number but a distribution: the median plus percentiles, which become the confidence bounds."],
  ["Rolling-origin backtest", "Pretend to stand at a past date, hide the future, forecast, compare. Repeat, moving the starting point back."],
  ["Baseline", "The naive method the model has to beat to justify itself. If it does not beat it, the model is not earning its place."],
  ["MAE", "Mean absolute error. How far off you are on average, in real units, with no cancelling between over- and under-shoots."],
  ["EAV schema", "Entity-attribute-value. One row per fact instead of one column per attribute, so adding a data source never changes the schema."],
  ["Upsert", "Insert, and update instead of failing if the row already exists. Makes every load safely repeatable."],
  ["Row-level security", "Access rules inside Postgres. Here: public read, writes only with the service key."],
];

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ArchitectureDiagram() {
  const boxes = [
    {
      x: 8,
      title: "Python pipeline",
      sub: "ingestion + forecasting",
      lines: ["ETL from public sources", "TimesFM 3.0 forecasting"],
      note: "Runs on CPU, no GPU needed.",
    },
    {
      x: 238,
      title: "Supabase",
      sub: "Postgres, managed by Lovable",
      lines: ["zones · indicators · forecasts", "scores · knowledge graph"],
      note: "Row-level security, public read, no writes.",
    },
    {
      x: 468,
      title: "Lovable",
      sub: "TanStack Start + React",
      lines: ["map · screening", "chat · knowledge graph"],
      note: "",
    },
  ];
  return (
    <svg
      viewBox="0 0 700 300"
      role="img"
      aria-label="Architecture: Python pipeline writes indicators and forecasts to Supabase, Lovable reads from Supabase, and an AI gateway supplies chat answers to Lovable."
      className="w-full"
    >
      {boxes.map((b) => (
        <g key={b.title}>
          <rect
            x={b.x}
            y={70}
            width={194}
            height={104}
            rx={16}
            fill="var(--color-card)"
            stroke="var(--color-border)"
          />
          <text x={b.x + 18} y={98} fontSize={15} fontWeight={600} fill="var(--color-foreground)">
            {b.title}
          </text>
          <text x={b.x + 18} y={116} fontSize={11} fill="var(--color-muted-foreground)">
            {b.sub}
          </text>
          {b.lines.map((line, i) => (
            <text
              key={line}
              x={b.x + 18}
              y={140 + i * 15}
              fontSize={11}
              fill="var(--color-foreground)"
            >
              {line}
            </text>
          ))}
          {b.note ? (
            <text x={b.x + 18} y={196} fontSize={10.5} fill="var(--color-muted-foreground)">
              {b.note.length > 44 ? b.note.slice(0, 44) : b.note}
            </text>
          ) : null}
          {b.note && b.note.length > 44 ? (
            <text x={b.x + 18} y={210} fontSize={10.5} fill="var(--color-muted-foreground)">
              {b.note.slice(44)}
            </text>
          ) : null}
        </g>
      ))}

      <defs>
        <marker id="sys-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
        </marker>
      </defs>

      <line
        x1={204}
        y1={122}
        x2={232}
        y2={122}
        stroke="var(--color-muted-foreground)"
        strokeWidth={1.2}
        markerEnd="url(#sys-arrow)"
      />
      <text x={218} y={56} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
        writes indicators
      </text>
      <text x={218} y={68} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
        and forecasts
      </text>

      <line
        x1={434}
        y1={122}
        x2={462}
        y2={122}
        stroke="var(--color-muted-foreground)"
        strokeWidth={1.2}
        markerEnd="url(#sys-arrow)"
      />
      <text x={448} y={62} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
        reads
      </text>

      <rect
        x={468}
        y={238}
        width={194}
        height={44}
        rx={14}
        fill="var(--highlight-soft)"
        stroke="var(--color-border)"
      />
      <text x={486} y={266} fontSize={13} fontWeight={600} fill="var(--color-foreground)">
        AI gateway
      </text>
      <line
        x1={565}
        y1={236}
        x2={565}
        y2={180}
        stroke="var(--color-muted-foreground)"
        strokeWidth={1.2}
        markerEnd="url(#sys-arrow)"
      />
      <text x={578} y={212} fontSize={10.5} fill="var(--color-muted-foreground)">
        chat answers
      </text>
    </svg>
  );
}

function PipelineDiagram() {
  const stages: Array<[string, string[]]> = [
    ["Public sources", ["PVGIS, ISTAT, GME"]],
    ["Ingestion", ["Python, on CPU"]],
    ["Indicators", ["one generic table"]],
    ["Scoring and forecasting", ["explicit weights,", "TimesFM"]],
    ["Interface", ["map, chat, graph"]],
  ];
  return (
    <svg
      viewBox="0 0 700 150"
      role="img"
      aria-label="Pipeline: public sources, ingestion, indicators, scoring and forecasting, interface."
      className="w-full"
    >
      <defs>
        <marker id="sys-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
        </marker>
      </defs>
      {stages.map(([title, caption], i) => {
        const x = 4 + i * 140;
        return (
          <g key={title}>
            <rect
              x={x}
              y={30}
              width={124}
              height={70}
              rx={14}
              fill="var(--color-card)"
              stroke="var(--color-border)"
            />
            <text
              x={x + 62}
              y={56}
              fontSize={11.5}
              fontWeight={600}
              textAnchor="middle"
              fill="var(--color-foreground)"
            >
              {title.length > 16 ? title.split(" and ")[0] : title}
            </text>
            {title.length > 16 ? (
              <text x={x + 62} y={70} fontSize={11.5} fontWeight={600} textAnchor="middle" fill="var(--color-foreground)">
                and forecasting
              </text>
            ) : null}
            {caption.map((line, j) => (
              <text
                key={line}
                x={x + 62}
                y={(title.length > 16 ? 88 : 76) + j * 13}
                fontSize={10}
                textAnchor="middle"
                fill="var(--color-muted-foreground)"
              >
                {line}
              </text>
            ))}
            {i < stages.length - 1 ? (
              <line
                x1={x + 128}
                y1={65}
                x2={x + 136}
                y2={65}
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.2}
                markerEnd="url(#sys-arrow2)"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function DailyCurveDiagram() {
  return (
    <svg viewBox="0 0 700 290" role="img"
      aria-label="Schematic daily electricity price curve: a midday trough caused by solar, an evening peak, and the spread between them."
      className="w-full">
      <line x1={60} y1={57} x2={620} y2={57} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
      <line x1={60} y1={190} x2={620} y2={190} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
      <text x={628} y={61} fontSize={11} fill="var(--color-muted-foreground)">MAX</text>
      <text x={628} y={194} fontSize={11} fill="var(--color-muted-foreground)">MIN</text>
      <polyline
        points="70,131 93,137 116,143 139,146 162,148 185,143 208,125 231,107 254,113 277,131 300,156 323,174 347,187 370,190 393,183 416,162 439,131 462,94 485,63 508,57 531,76 554,94 577,113 600,125"
        fill="none" stroke="var(--color-foreground)" strokeWidth={2} />
      <circle cx={370} cy={190} r={4} fill="var(--color-foreground)" />
      <circle cx={508} cy={57} r={4} fill="var(--color-foreground)" />
      <line x1={600} y1={57} x2={600} y2={190} stroke="var(--color-foreground)" strokeWidth={1.5} />
      <line x1={594} y1={57} x2={606} y2={57} stroke="var(--color-foreground)" strokeWidth={1.5} />
      <line x1={594} y1={190} x2={606} y2={190} stroke="var(--color-foreground)" strokeWidth={1.5} />
      <text x={612} y={128} fontSize={11} fill="var(--color-foreground)">spread</text>
      <text x={370} y={214} textAnchor="middle" fontSize={10.5} fill="var(--color-muted-foreground)">midday — solar pushes the price down</text>
      <text x={508} y={42} textAnchor="middle" fontSize={10.5} fill="var(--color-muted-foreground)">evening peak</text>
      <line x1={60} y1={240} x2={620} y2={240} stroke="var(--color-border)" />
      <text x={60} y={256} fontSize={10} fill="var(--color-muted-foreground)">00:00</text>
      <text x={335} y={256} fontSize={10} fill="var(--color-muted-foreground)">12:00</text>
      <text x={592} y={256} fontSize={10} fill="var(--color-muted-foreground)">24:00</text>
      <text x={60} y={282} fontSize={13} fill="var(--color-foreground)">spread = MAX × (1 − MIN/MAX) = level × shape</text>
    </svg>
  );
}

function DecompositionDiagram() {
  return (
    <svg
      viewBox="0 0 560 120"
      role="img"
      aria-label="Level times shape equals daily spread."
      className="w-full max-w-md"
    >
      {[
        { x: 6, title: "Level", sub: "daily max price", note: "follows gas" },
        { x: 206, title: "Shape", sub: "1 − min/max", note: "follows solar" },
      ].map((b) => (
        <g key={b.title}>
          <rect x={b.x} y={22} width={150} height={72} rx={14} fill="var(--color-card)" stroke="var(--color-border)" />
          <text x={b.x + 75} y={48} fontSize={13} fontWeight={600} textAnchor="middle" fill="var(--color-foreground)">
            {b.title}
          </text>
          <text x={b.x + 75} y={66} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
            {b.sub}
          </text>
          <text x={b.x + 75} y={82} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
            {b.note}
          </text>
        </g>
      ))}
      <text x={181} y={64} fontSize={16} textAnchor="middle" fill="var(--color-muted-foreground)">
        ×
      </text>
      <text x={381} y={64} fontSize={16} textAnchor="middle" fill="var(--color-muted-foreground)">
        =
      </text>
      <rect x={406} y={22} width={148} height={72} rx={14} fill="var(--highlight-soft)" stroke="var(--color-border)" />
      <text x={480} y={54} fontSize={13} fontWeight={600} textAnchor="middle" fill="var(--color-foreground)">
        Daily spread
      </text>
      <text x={480} y={72} fontSize={10.5} textAnchor="middle" fill="var(--color-muted-foreground)">
        EUR/MWh per cycle
      </text>
    </svg>
  );
}

function SystemPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[46rem] px-6 py-14">
          <header className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              System
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">How Forecastalo is built</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Forecastalo screens Italian territory for two kinds of energy investment. It combines
              open public data, explicit multi-criteria scores, and a time-series foundation model
              that forecasts electricity price spreads. Everything is public data; nothing is
              proprietary.
            </p>
          </header>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COUNTERS.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <p className="text-lg font-semibold tracking-tight">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 space-y-14">
            <Section eyebrow="02" title="Architecture">
              <div className="rounded-2xl border border-border bg-panel p-5 shadow-soft">
                <ArchitectureDiagram />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The three parts are independent, so the data pipeline can run and update without
                touching the frontend.
              </p>
            </Section>

            <Section eyebrow="03" title="Data flow">
              <div className="rounded-2xl border border-border bg-panel p-5 shadow-soft">
                <PipelineDiagram />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Indicators are stored in a single generic table keyed by zone, indicator code and
                period, so adding a new data source is a row in a registry rather than a schema
                migration.
              </p>
            </Section>

            <Section eyebrow="04" title="The models">
              <div className="space-y-4">
                <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="text-sm font-semibold">TimesFM 3.0 — forecasting</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Google's time-series foundation model,{" "}
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-[12px]">
                      google/timesfm-3.0-pytorch
                    </code>
                    , 331 million parameters. Forecasts 90 days of daily electricity prices for the 7
                    market zones. Runs on CPU: 14 series in about one second. Its weights are under a
                    non-commercial licence, which is fine for this project but would not be for a
                    product; TimesFM 2.5 (Apache 2.0) is supported as an alternative.
                  </p>
                </article>

                <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="text-sm font-semibold">
                    The decomposition — why it does not forecast the spread directly
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    The daily spread obeys an exact identity:{" "}
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-[12px]">
                      spread = max × (1 − min/max) = level × shape
                    </code>
                    . The level follows the price of gas — it tripled during the 2022 energy crisis.
                    The shape, bounded between 0 and 1, follows solar penetration — during that same
                    crisis it moved only from 0.41 to 0.47. Forecasting them separately keeps a gas
                    shock from being learned as seasonality, and avoids the heavy tail the relative
                    spread would have.
                  </p>
                  <div className="mt-5 space-y-3">
                    <DailyCurveDiagram />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      A typical day on the day-ahead market. The battery buys at the trough and sells
                      at the peak; the spread is its gross revenue per cycle, before round-trip
                      efficiency, degradation and grid charges.
                    </p>
                    <div className="pt-2">
                      <DecompositionDiagram />
                    </div>
                  </div>
                </article>

                <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="text-sm font-semibold">The chat</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Answers are grounded by structured retrieval against Postgres, not vector search.
                    For tabular data, similarity search over embeddings returns noise — "which
                    province has the oldest building stock" is answered by an ORDER BY, not by nearby
                    vectors. The chat resolves the zones named in the question, pulls their real
                    rows, adds aggregate statistics and the matching knowledge-graph notes, and only
                    then asks the model. It is instructed never to invent a number and to say what is
                    missing.
                  </p>
                </article>
              </div>
            </Section>

            <Section eyebrow="05" title="Key terms">
              <div className="grid gap-3 sm:grid-cols-2">
                {KEY_TERMS.map(([term, definition]) => (
                  <div
                    key={term}
                    className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                  >
                    <p className="text-sm font-semibold">{term}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {definition}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section eyebrow="06" title="Does the forecast actually work">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-soft">
                <table className="w-full text-sm">
                  <caption className="px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground">
                    Mean absolute error in EUR/MWh on the reconstructed spread, 90-day horizon, ten
                    rolling-origin windows from 2019 to 2026. Each window uses only the zones that
                    already existed at that date — Calabria became a separate bidding zone on
                    1 January 2021. Lower is better; the best in each row is in bold.
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Window</th>
                      <th className="px-4 py-2 font-medium">Spread</th>
                      <th className="px-4 py-2 font-medium">TimesFM</th>
                      <th className="px-4 py-2 font-medium">Persistence</th>
                      <th className="px-4 py-2 font-medium">Seasonal</th>
                      <th className="px-4 py-2 font-medium">30-day mean</th>
                      <th className="px-4 py-2 font-medium">365-day mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BACKTEST.map((row) => (
                      <tr key={row.window} className="border-b border-border/60 last:border-0">
                        <td
                          className={`px-4 py-2.5 ${row.strong ? "font-semibold" : "text-muted-foreground"}`}
                        >
                          {row.window}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {row.spread}
                        </td>
                        {row.cells.map((cell, i) => (
                          <td
                            key={i}
                            className={`px-4 py-2.5 tabular-nums ${
                              i === row.best ? "font-semibold text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                TimesFM is best in 6 of the 10 windows and has both the lowest mean error and the
                lowest relative error. The margin over the strongest baseline — a 30-day moving
                average — is 9%. Real, but not a landslide.
              </p>
              <div className="rounded-2xl border border-border bg-highlight-soft p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Where it wins, and where it does not
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Split by factor across all ten windows, the picture is sharper than the headline.
                  On the shape factor TimesFM cuts error by 58% against persistence (0.108 versus
                  0.260). On the level factor it is 13.5% worse than persistence (46.9 versus
                  41.3 EUR/MWh). The intraday shape has learnable structure; the price level is
                  driven by gas and is close to a random walk. This is also why the summer-2022
                  window is the one clear defeat: during the gas crisis, repeating the last value is
                  the correct answer to a regime nobody has seen before.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-highlight-soft p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Caveat
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  29.4 EUR/MWh against spreads averaging 90 to 100 is roughly a third of relative
                  error. Good enough to rank zones, not to build a business plan on.
                </p>
              </div>
            </Section>

            <Section eyebrow="07" title="Data sources">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-soft">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">What it provides</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCES.map(([source, provides, status]) => (
                      <tr key={source} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 font-medium">{source}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{provides}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section eyebrow="08" title="Known limits">
              <div className="rounded-2xl border-2 border-border bg-panel p-6 shadow-panel">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  What this system does not know matters as much as what it scores.
                </p>
                <ul className="mt-4 space-y-4">
                  {LIMITS.map((limit) => (
                    <li key={limit} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-highlight" />
                      <span>{limit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          </div>

          <p className="mt-14 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
            This page describes the system as built. The{" "}
            <Link to="/graph" className="underline underline-offset-4 hover:text-foreground">
              knowledge graph
            </Link>{" "}
            holds the detailed reasoning behind each choice.
          </p>
        </div>
      </main>
    </div>
  );
}
