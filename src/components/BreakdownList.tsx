import {
  formatPart,
  formatWeight,
  horizonWeightFor,
  parseBreakdown,
  type Breakdown,
  type BreakdownPart,
} from "@/lib/score-types";

function keyOf(label: string) {
  return label;
}

export default function BreakdownList({
  breakdown,
  play,
  horizon,
}: {
  breakdown: Breakdown;
  play?: string;
  horizon?: string;
}) {
  const { factors, context, missing } = parseBreakdown(breakdown);
  if (factors.length === 0 && context.length === 0 && missing.length === 0) return null;

  function weightCell(rawKey: string, part: BreakdownPart) {
    const active = play && horizon ? horizonWeightFor(play, horizon, rawKey) : null;
    if (active == null) {
      return <span className="ml-2 text-muted-foreground">{formatWeight(part)}</span>;
    }
    const stored = part.weight;
    const changed = stored != null && Math.abs(stored - active) > 0.0005;
    const caret = changed && stored != null ? (active > stored ? "▲" : "▼") : null;
    return (
      <span className={changed ? "ml-2 font-medium text-highlight" : "ml-2 text-muted-foreground"}>
        weight {Math.round(active * 100)}%
        {caret ? <span className="ml-1 text-[10px]">{caret}</span> : null}
      </span>
    );
  }

  return (
    <div className="mt-3">
      {factors.map(([label, part, rawKey]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 border-t border-border py-1.5"
        >
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-right text-xs">
            <span className="font-medium text-foreground">{formatPart(part)}</span>
            {weightCell(keyOf(rawKey), part)}
          </span>
        </div>
      ))}

      {context.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2">
          {context.map(([label, value]) => (
            <span key={label} className="text-[11px] text-muted-foreground">
              {label}: <span className="text-foreground">{value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="mt-2 rounded-lg bg-muted px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Not included in this score
          </p>
          <ul className="mt-1 grid gap-0.5">
            {missing.map((item) => (
              <li key={item} className="text-xs text-muted-foreground">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
