export type BreakdownPart = {
  value: number | null;
  unit: string | null;
  weight: number | null;
  normalised: number | null;
};

export type Breakdown = {
  solar?: BreakdownPart;
  market_size?: BreakdownPart;
  demographics?: BreakdownPart;
} | null;

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
