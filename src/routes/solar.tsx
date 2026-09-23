import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppSidebar from "@/components/AppSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/solar")({
  head: () => ({
    meta: [
      { title: "Solar Revenue — Capture Rates Across Italy" },
      {
        name: "description",
        content:
          "Monthly solar capture rates and a 90-day forecast for Italy's seven electricity market zones.",
      },
      { property: "og:title", content: "Solar Revenue — Forecastalo" },
      {
        property: "og:description",
        content:
          "See how solar cannibalisation is changing capture rates across Italy's electricity market zones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SolarPage,
});

type MarketZone = { id: string; name: string };
type CapturePoint = {
  period: string;
  actual: number | null;
  forecast: number | null;
  band: [number, number] | null;
};

const ZONE_ORDER = ["Nord", "Centro Nord", "Centro Sud", "Sud", "Calabria", "Sicilia", "Sardegna"];

const YEARLY_ROWS = [
  ["2021", "101.3%", "101.1%", "99.0%", "98.1%", "98.2%", "95.3%", "95.0%"],
  ["2022", "98.0%", "98.4%", "96.0%", "95.3%", "95.3%", "94.3%", "93.5%"],
  ["2023", "93.9%", "94.6%", "92.5%", "91.7%", "90.9%", "89.5%", "89.0%"],
  ["2024", "92.5%", "92.0%", "91.4%", "90.7%", "90.9%", "89.7%", "82.6%"],
  ["2025", "88.1%", "89.0%", "88.2%", "88.2%", "88.5%", "86.8%", "79.0%"],
  ["2026", "87.2%", "88.3%", "85.1%", "82.3%", "82.8%", "79.1%", "80.4%"],
] as const;

const ZONE_COMMENTARY: Record<string, { kicker: string; body: string }> = {
  Nord: {
    kicker: "The steepest fall from the highest start",
    body: "In 2021 a plant in Nord still earned slightly more than the market average: 101.3%. That premium is gone — 87.2% in 2026, a fall of 2.8 points a year. The seasonal split is wide, 96.1% in winter against 83.6% in summer, so the damage lands in exactly the months that produce the most. Nord also has the narrowest price spread in the country at 77 €/MWh, which is the same fact read from the other side: the zone where solar still earns the most is the zone where a battery earns the least.",
  },
  "Centro Nord": {
    kicker: "The most stable zone in the country",
    body: "The slowest decline of the seven at 2.6 points a year, and the highest capture rate left standing at 88.3%. Daily volatility is also the lowest, a standard deviation of 15.1 against 19.7 in Sardegna. Its summer-winter gap of 12.5 points looks like Nord's, but it sits on a base that has eroded less. If the question is where a merchant solar plant is least exposed to cannibalisation today, this is the answer.",
  },
  "Centro Sud": {
    kicker: "A northern decline rate on a southern level",
    body: "85.1% in 2026, falling 2.8 points a year — the same pace as Nord, from a level already 3 points lower. The summer-winter gap is the widest on the mainland at 13.1 points. With a spread of 85 €/MWh it sits close to the median of the seven zones on both metrics, which makes it a useful reference point and an unremarkable case.",
  },
  Sud: {
    kicker: "The erosion is year-round, not seasonal",
    body: "Sud falls fastest, 3.2 points a year, from 98.1% in 2021 to 82.3% in 2026. What sets it apart is the shape of the damage: the summer-winter gap is only 8.9 points, second narrowest of the seven. Elsewhere cannibalisation is a summer problem; here winter capture is already down to 91.5%. That points to structural oversupply and export constraints rather than a seasonal midday dip, and it fits a spread of 90 €/MWh, well above the north.",
  },
  Calabria: {
    kicker: "Five years of history and no more",
    body: "A separate bidding zone only since 1 January 2021, so there is nothing before that to compare against. Since then: 98.2% down to 82.8%, 3.1 points a year, with the narrowest summer-winter gap of all seven at 8.2 points. Like Sud, the erosion runs through the whole year rather than concentrating in summer. Its numbers track Sud closely on every measure, which is what you would expect from a zone carved out of it.",
  },
  Sicilia: {
    kicker: "The lowest in Italy, and the only one that recovered first",
    body: "79.1% in 2026, the lowest capture rate in the country, and the only zone with a non-monotonic history: 86.8% back in 2017 when grid isolation already separated its prices, a recovery to 95.3% by 2021 as interconnection improved, then the steepest fall of the seven back down. It also has the widest spread in Italy at 101 €/MWh. Day to day, though, capture rate and spread barely move together here (−0.11): in a congested zone both are set by the constraint rather than by each other.",
  },
  Sardegna: {
    kicker: "The harshest summer of the seven",
    body: "75.3% in summer against 90.4% in winter — a 15.1-point gap, the widest in the country — and the highest daily volatility, a standard deviation of 19.7. Its 80.4% in 2026 is second lowest. It is also the only zone where the day-to-day link between capture rate and spread is genuinely strong (−0.41): with weak interconnection a deep midday collapse both widens the arbitrage window and destroys solar revenue on the same day. Of all seven zones this is where the two plays are most visibly two sides of one trade.",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function SolarPage() {
  const [selectedZoneId, setSelectedZoneId] = useState("");

  const zonesQuery = useQuery({
    queryKey: ["solar-capture-zones"],
    queryFn: async (): Promise<MarketZone[]> => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, name")
        .eq("level", "market_zone");
      if (error) throw error;
      const rows = data ?? [];
      return rows.sort((a, b) => {
        const aIndex = ZONE_ORDER.indexOf(a.name);
        const bIndex = ZONE_ORDER.indexOf(b.name);
        return (aIndex === -1 ? ZONE_ORDER.length : aIndex) -
          (bIndex === -1 ? ZONE_ORDER.length : bIndex);
      });
    },
  });

  const zones = zonesQuery.data ?? [];
  const nord = zones.find((zone) => zone.name === "Nord");
  const activeZoneId = selectedZoneId || nord?.id || zones[0]?.id || "";
  const activeZone = zones.find((zone) => zone.id === activeZoneId);
  const zoneCommentary = activeZone ? ZONE_COMMENTARY[activeZone.name] : undefined;

  const seriesQuery = useQuery({
    queryKey: ["solar-capture-series", activeZoneId],
    enabled: activeZoneId.length > 0,
    queryFn: async (): Promise<CapturePoint[]> => {
      const [historyResult, forecastResult] = await Promise.all([
        supabase
          .from("indicators")
          .select("period, value")
          .eq("zone_id", activeZoneId)
          .eq("indicator_code", "solar_capture_rate")
          .order("period", { ascending: true }),
        supabase
          .from("forecasts")
          .select("period, value_forecast, lower_bound, upper_bound")
          .eq("zone_id", activeZoneId)
          .eq("indicator_code", "solar_capture_rate")
          .eq("model_version", "timesfm-3.0")
          .order("period", { ascending: true }),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (forecastResult.error) throw forecastResult.error;

      const points: CapturePoint[] = (historyResult.data ?? []).map((row) => ({
        period: String(row.period),
        actual: row.value == null ? null : Number(row.value),
        forecast: null,
        band: null,
      }));
      const lastActual = points[points.length - 1];
      if (lastActual) lastActual.forecast = lastActual.actual;

      for (const row of forecastResult.data ?? []) {
        points.push({
          period: String(row.period),
          actual: null,
          forecast: row.value_forecast == null ? null : Number(row.value_forecast),
          band:
            row.lower_bound == null || row.upper_bound == null
              ? null
              : [Number(row.lower_bound), Number(row.upper_bound)],
        });
      }
      return points;
    },
  });

  const chartPoints = useMemo(() => seriesQuery.data ?? [], [seriesQuery.data]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar compactOnMobile />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[46rem] px-6 py-14">
          <header className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Market intelligence
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Solar revenue</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A solar plant does not earn the market price. It earns the average price weighted by
              its own production — and because solar produces when prices collapse at midday, that
              is less. The ratio is the capture rate. It has fallen from above 100% in the north in
              2017 to the low 80s today.
            </p>
          </header>

          <div className="mt-8 max-w-xs space-y-2">
            <label htmlFor="solar-zone" className="text-xs font-medium text-muted-foreground">
              Market zone
            </label>
            <Select value={activeZoneId} onValueChange={setSelectedZoneId}>
              <SelectTrigger id="solar-zone" className="rounded-xl bg-card">
                <SelectValue placeholder={zonesQuery.isPending ? "Loading zones…" : "Select a zone"} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-14 space-y-14">
            <Section title={`${activeZone?.name ?? "Nord"} capture rate`}>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">Monthly history and daily forecast</p>
                  <p className="text-[11px] text-muted-foreground">2016–2026</p>
                </div>
                <div className="mt-4 h-80">
                  {zonesQuery.isError || seriesQuery.isError ? (
                    <p className="pt-28 text-center text-xs text-muted-foreground">
                      Capture-rate data could not be loaded.
                    </p>
                  ) : zonesQuery.isPending || seriesQuery.isPending ? (
                    <p className="pt-28 text-center text-xs text-muted-foreground">Loading chart…</p>
                  ) : chartPoints.length === 0 ? (
                    <p className="pt-28 text-center text-xs text-muted-foreground">
                      No capture-rate data is available for this zone.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartPoints} margin={{ top: 6, right: 10, bottom: 0, left: 4 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value: string) => value.slice(0, 4)}
                          minTickGap={52}
                          stroke="currentColor"
                          strokeOpacity={0.2}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                          width={42}
                          domain={["auto", "auto"]}
                          stroke="currentColor"
                          strokeOpacity={0.2}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                          labelFormatter={(label) => String(label)}
                          formatter={(value: unknown, name) => {
                            if (Array.isArray(value)) {
                              return [
                                `${formatPercentage(Number(value[0]))}–${formatPercentage(Number(value[1]))}`,
                                "10th–90th percentile",
                              ];
                            }
                            return [
                              formatPercentage(Number(value)),
                              name === "actual" ? "Monthly capture rate" : "Forecast",
                            ];
                          }}
                        />
                        <ReferenceLine
                          y={1}
                          label={{ value: "market average", position: "insideTopRight", fontSize: 10 }}
                          stroke="currentColor"
                          strokeOpacity={0.3}
                          strokeDasharray="2 3"
                        />
                        <Area
                          dataKey="band"
                          stroke="none"
                          fill="#3b82f6"
                          fillOpacity={0.12}
                          isAnimationActive={false}
                          connectNulls
                        />
                        <Line
                          dataKey="actual"
                          stroke="#334155"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="forecast"
                          stroke="#1d4ed8"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          dot={false}
                          isAnimationActive={false}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </Section>

            {zoneCommentary ? (
              <Section title="What this zone is telling you">
                <div className="rounded-2xl bg-highlight-soft p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {zoneCommentary.kicker}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{zoneCommentary.body}</p>
                </div>
              </Section>
            ) : null}

            <Section title="Capture rate by year">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-soft">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      {["Year", ...ZONE_ORDER].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-3 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {YEARLY_ROWS.map((row) => (
                      <tr key={row[0]} className="border-b border-border/60 last:border-0">
                        {row.map((cell, index) => (
                          <td
                            key={`${row[0]}-${index}`}
                            className={`whitespace-nowrap px-3 py-2.5 tabular-nums ${
                              index === 0 ? "font-medium" : "text-muted-foreground"
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
              <p className="text-xs leading-relaxed text-muted-foreground">
                January–August of each year, so the partial 2026 is compared like for like. Calabria
                became a separate bidding zone on 1 January 2021.
              </p>
            </Section>

            <Section title="Why this matters">
              <div className="rounded-2xl border border-border bg-highlight-soft p-5">
                <p className="text-sm leading-relaxed">
                  At 1.5 GW — roughly the size of an Italian O&amp;M portfolio — a capture rate of 91%
                  instead of 100% is about 9 €/MWh on some 2 TWh a year. The gap between the price
                  everyone quotes and the price actually received runs into the tens of millions
                  annually, and it is widening.
                </p>
              </div>
            </Section>

            <Section title="How it is computed">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hourly zonal day-ahead prices from GME, crossed with an hourly PV production profile
                from PVGIS. The profile is climatological — the 2019–2023 mean for each day of the
                year at a representative point in each zone — rather than the actual weather of each
                year. That is deliberate: with a fixed profile, any movement in the metric is caused
                by prices, not by whether a given year happened to be sunny. It measures
                cannibalisation, not weather.
              </p>
            </Section>

            <Section title="Does the forecast hold up">
              <div className="rounded-2xl border border-border bg-highlight-soft p-5">
                <p className="text-sm leading-relaxed">
                  Rolling-origin backtest, ten windows from 2019 to 2026, 90-day horizon, against
                  persistence, seasonal and trailing-mean baselines. TimesFM 3.0 was best in 9 of the
                  10 windows, with a mean absolute error of 6.26 percentage points against 7.96 for
                  the strongest baseline — a 21% margin, and roughly 7% relative error.
                </p>
                <p className="mt-4 text-sm leading-relaxed">
                  That is markedly better than the same model on the daily price spread, where it
                  wins 6 of 10 with a 9% margin. The reason is algebraic: the capture rate is a ratio
                  of two averages over the same day, so the price level cancels out. A gas shock
                  multiplies numerator and denominator alike and disappears. What remains is the
                  intraday shape — the one factor where the model cuts error by 58% against
                  persistence. The summer-2022 window, the single clear defeat on the spread, is won
                  here.
                </p>
              </div>
            </Section>

            <Section title="Two plays, one signal">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Across the seven zones the rank correlation between capture rate and spread is −0.96.
                Capture rate runs from 82.8% in Sicilia to 91.0% in Centro Nord; spread runs the other
                way, from 101 €/MWh down to 77. It is almost a straight line, and it is one piece of
                physics read from two ends: the midday collapse that destroys solar revenue is the
                same collapse that opens the arbitrage window. Within any single zone the daily link
                is far weaker, between −0.11 and −0.41. So the relationship is structural and
                geographic, not a trading signal — it says where to build a battery, not when to cycle
                it.
              </p>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}