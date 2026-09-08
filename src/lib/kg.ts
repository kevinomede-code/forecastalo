export type KgNode = {
  slug: string;
  title: string;
  kind: string;
  summary: string;
  detail: string | null;
  refs: Record<string, unknown> | null;
};

export type KgEdge = {
  source_slug: string;
  target_slug: string;
  relation: string;
  note: string | null;
};

export const KG_KINDS = [
  "source",
  "indicator",
  "zone",
  "play",
  "factor",
  "model",
  "method",
  "finding",
  "limit",
] as const;

export type KgKind = (typeof KG_KINDS)[number];

// Muted, light-UI friendly palette — one hue per kind.
export const KIND_COLORS: Record<string, string> = {
  source: "#8ba3c7",
  indicator: "#7fa8a0",
  zone: "#a8a897",
  play: "#8f9bc4",
  factor: "#c7a58b",
  model: "#a99ac2",
  method: "#93b0c9",
  finding: "#9fb98c",
  limit: "#c79191",
};

export const KIND_LABELS: Record<string, string> = {
  source: "Source",
  indicator: "Indicator",
  zone: "Zone",
  play: "Play",
  factor: "Factor",
  model: "Model",
  method: "Method",
  finding: "Finding",
  limit: "Limit",
};

export function colorFor(kind: string) {
  return KIND_COLORS[kind] ?? "#a3a3a3";
}

export function labelForKind(kind: string) {
  return KIND_LABELS[kind] ?? kind;
}
