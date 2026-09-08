import { formatPart, formatWeight, parseBreakdown, type Breakdown } from "@/lib/score-types";

export default function BreakdownList({ breakdown }: { breakdown: Breakdown }) {
  const { factors, context, missing } = parseBreakdown(breakdown);
  if (factors.length === 0 && context.length === 0 && missing.length === 0) return null;

  return (
    <div className="mt-3">
      {factors.map(([label, part]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 border-t border-border py-1.5"
        >
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-right text-xs">
            <span className="font-medium text-foreground">{formatPart(part)}</span>
            <span className="ml-2 text-muted-foreground">{formatWeight(part)}</span>
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
