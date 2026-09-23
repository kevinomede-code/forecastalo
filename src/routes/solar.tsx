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
          </div>
        </div>
      </main>
    </div>
  );
}