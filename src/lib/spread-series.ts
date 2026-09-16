import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SpreadPoint = {
  period: string;
  actual: number | null;
  forecast: number | null;
  band: [number, number] | null;
};

export type SpreadSeries = {
  points: SpreadPoint[];
  boundary: string | null;
  /** Mean of the most recent 30 actual days. */
  recentAvg: number | null;
  /** Mean of the 90-day TimesFM forecast. */
  forecastAvg: number | null;
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Shared between SpreadChart and ZoneEconomics — one query per zone. */
export function useSpreadSeries(zoneId: string) {
  return useQuery({
    queryKey: ["spread-chart", zoneId],
    queryFn: async (): Promise<SpreadSeries> => {
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

      const descending = actualRes.data ?? [];
      const recentAvg = mean(
        descending
          .slice(0, 30)
          .map((row) => Number(row.value))
          .filter((value) => Number.isFinite(value)),
      );

      const actuals = descending.slice().reverse();
      const points: SpreadPoint[] = actuals.map((row) => ({
        period: String(row.period),
        actual: row.value == null ? null : Number(row.value),
        forecast: null,
        band: null,
      }));

      const last = points[points.length - 1];
      const boundary = last?.period ?? null;
      if (last) last.forecast = last.actual;

      const forecastValues: number[] = [];
      for (const row of forecastRes.data ?? []) {
        const value = row.value_forecast == null ? null : Number(row.value_forecast);
        if (value != null && Number.isFinite(value)) forecastValues.push(value);
        points.push({
          period: String(row.period),
          actual: null,
          forecast: value,
          band:
            row.lower_bound == null || row.upper_bound == null
              ? null
              : [Number(row.lower_bound), Number(row.upper_bound)],
        });
      }

      return { points, boundary, recentAvg, forecastAvg: mean(forecastValues) };
    },
  });
}
