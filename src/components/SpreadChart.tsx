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
import { useSpreadSeries } from "@/lib/spread-series";


export default function SpreadChart({
  zoneId,
  zoneName,
}: {
  zoneId: string;
  zoneName: string;
}) {
  const query = useQuery({
    queryKey: ["spread-chart", zoneId],
    queryFn: async () => {
      const [actualRes, forecastRes] = await Promise.all([
        supabase
          .from("indicators")
          .select("period, value")
          .eq("zone_id", zoneId)
          .eq("indicator_code", "price_spread_eur_mwh")
          .order("period", { ascending: false })
          .limit(120),
        supabase
          .from("forecasts")
          .select("period, value_forecast, lower_bound, upper_bound")
          .eq("zone_id", zoneId)
          .eq("indicator_code", "price_spread_eur_mwh")
          .eq("model_version", "timesfm-3.0")
          .order("period", { ascending: true })
          .limit(90),
      ]);
      if (actualRes.error) throw actualRes.error;
      if (forecastRes.error) throw forecastRes.error;

      const actuals = (actualRes.data ?? []).slice().reverse();
      const points: Point[] = actuals.map((row) => ({
        period: String(row.period),
        actual: row.value == null ? null : Number(row.value),
        forecast: null,
        band: null,
      }));

      const last = points[points.length - 1];
      const boundary = last?.period ?? null;
      if (last) last.forecast = last.actual;

      for (const row of forecastRes.data ?? []) {
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

      return { points, boundary };
    },
  });

  const points = query.data?.points ?? [];

  return (
    <div className="shrink-0 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{zoneName} — daily price spread</p>
        <p className="text-[11px] text-muted-foreground">
          120 days actual, then 90 days forecast
        </p>
      </div>

      <div className="mt-3 h-40">
        {query.isPending ? (
          <p className="pt-10 text-center text-xs text-muted-foreground">Loading chart…</p>
        ) : query.isError || points.length === 0 ? (
          <p className="pt-10 text-center text-xs text-muted-foreground">
            No price history available for this zone.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10 }}
                tickFormatter={(value: string) => value.slice(2, 7)}
                minTickGap={28}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={34}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                formatter={(value: unknown, name) => [
                  Array.isArray(value)
                    ? `${Number(value[0]).toFixed(0)}–${Number(value[1]).toFixed(0)} EUR/MWh`
                    : `${Number(value).toFixed(1)} EUR/MWh`,
                  name === "actual" ? "Actual" : name === "forecast" ? "Forecast" : "Range",
                ]}
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
              {query.data?.boundary ? (
                <ReferenceLine
                  x={query.data.boundary}
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeDasharray="2 3"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
