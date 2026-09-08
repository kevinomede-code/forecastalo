export type BreakdownPart = {
  value: number | null;
  unit: string | null;
  weight: number | null;
  normalised: number | null;
  full_marks_at?: number | null;
  range?: string | null;
  province_level?: boolean;
};

export type Breakdown = Record<string, unknown> | null;

export type ScoreRow = {
  zone_id: string;
  score_total: number | null;
  recommendation: string | null;
  breakdown: Breakdown;
  zones: {
    name: string;
    level: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export type MapFocus = { zoneId: string; nonce: number } | null;

const LABELS: Record<string, string> = {
  solar: "Solar",
  market_size: "Market size",
  demographics: "Demographics",
  building_stock: "Building stock",
  forecast_spread: "Forecast spread",
  downside: "Downside",
  momentum: "Momentum",
  historical_spread_12m: "Historical spread, 12m",
  forecast_upper: "Forecast upper bound",
  forecast_days: "Forecast days",
  model: "Model",
};

export function labelFor(key: string) {
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function isPart(value: unknown): value is BreakdownPart {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "weight" in (value as Record<string, unknown>)
  );
}

export type ParsedBreakdown = {
  factors: Array<[string, BreakdownPart]>;
  context: Array<[string, string]>;
  missing: string[];
};

export function parseBreakdown(breakdown: Breakdown): ParsedBreakdown {
  const factors: Array<[string, BreakdownPart]> = [];
  const context: Array<[string, string]> = [];
  const missing: string[] = [];

  for (const [key, value] of Object.entries(breakdown ?? {})) {
    if (key === "missing" && Array.isArray(value)) {
      missing.push(...value.map((item) => String(item)));
      continue;
    }
    if (key === "context" && typeof value === "object" && value !== null) {
      for (const [ck, cv] of Object.entries(value as Record<string, unknown>)) {
        if (cv === null || typeof cv === "object") continue;
        context.push([labelFor(ck), String(cv)]);
      }
      continue;
    }
    if (isPart(value)) factors.push([labelFor(key), value]);
  }

  factors.sort((a, b) => (b[1].weight ?? 0) - (a[1].weight ?? 0));

  return { factors, context, missing };

}

export function formatPart(part: BreakdownPart) {
  const value = part.value == null ? "—" : String(part.value);
  const unit = part.unit ? ` ${part.unit}` : "";
  return `${value}${unit}`;
}

export function formatWeight(part: BreakdownPart) {
  return part.weight == null ? "" : `weight ${Math.round(part.weight * 100)}%`;
}
