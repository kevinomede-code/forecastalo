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
  factors: Array<[string, BreakdownPart, string]>;
  context: Array<[string, string]>;
  missing: string[];
};

export function parseBreakdown(breakdown: Breakdown): ParsedBreakdown {
  const factors: Array<[string, BreakdownPart, string]> = [];
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

// Horizon = investment holding period, not forecast horizon. The 90-day price
// forecast is the same in every case; what changes is how much it is trusted.
// Short horizon: lean on what is measurable now. Long horizon: lean on what
// compounds, and discount a point forecast that far out.
export const HORIZON_WEIGHTS: Record<string, Record<string, Record<string, number>>> = {
  housing_energy: {
    // Solar keeps weight 0.30 at every horizon: the sun does not care how long you hold the asset.
    "1": { solar: 0.30, market_size: 0.35, building_stock: 0.25, demographics: 0.10 },
    "3": { solar: 0.30, market_size: 0.25, building_stock: 0.25, demographics: 0.20 },
    "5": { solar: 0.30, market_size: 0.15, building_stock: 0.25, demographics: 0.30 },
  },
  battery_storage: {
    "1": { forecast_spread: 0.65, downside: 0.25, momentum: 0.10 },
    "3": { forecast_spread: 0.55, downside: 0.25, momentum: 0.20 },
    "5": { forecast_spread: 0.35, downside: 0.30, momentum: 0.35 },
  },
};

export function horizonWeightFor(play: string, horizon: string, key: string): number | null {
  const weights = HORIZON_WEIGHTS[play]?.[horizon];
  if (!weights) return null;
  const weight = weights[key];
  return typeof weight === "number" ? weight : null;
}

export function horizonScore(
  play: string,
  breakdown: Breakdown,
  horizon: string,
  fallback: number | null,
): number {
  const weights = HORIZON_WEIGHTS[play]?.[horizon];
  if (!weights) return fallback ?? 0;

  const source = (breakdown ?? {}) as Record<string, unknown>;
  let weighted = 0;
  let total = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const part = source[key];
    if (!isPart(part)) continue;
    const normalised = part.normalised;
    if (typeof normalised !== "number" || !Number.isFinite(normalised)) continue;
    weighted += weight * normalised;
    total += weight;
  }

  if (total === 0) return fallback ?? 0;
  return Math.round((100 * weighted) / total * 10) / 10;
}
