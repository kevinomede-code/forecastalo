import { useMemo } from "react";
import {
  batteryEconomics,
  formatEur,
  housingEconomics,
  roiPct,
  type Economics,
} from "@/lib/economics";
import type { Breakdown } from "@/lib/score-types";
import { useSpreadSeries } from "@/lib/spread-series";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function paybackLabel(economics: Economics) {
  return economics.paybackYears == null ? "—" : `${economics.paybackYears.toFixed(1)} years`;
}

function roiLabel(economics: Economics, years: number) {
  if (economics.annual <= 0) return "—";
  const value = roiPct(economics, years);
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}

function Footnote({ economics }: { economics: Economics }) {
  return (
    <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
      {economics.assumptions.length > 0 ? (
        <p>Assumptions: {economics.assumptions.join("; ")}.</p>
      ) : null}
      {economics.missing.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </div>
  );
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="shrink-0 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function HousingEconomics({
  breakdown,
  horizonYears,
  zoneName,
}: {
  breakdown: Breakdown;
  horizonYears: number;
  zoneName: string;
}) {
  const economics = useMemo(() => housingEconomics(breakdown), [breakdown]);
  if (!economics) return null;

  return (
    <Shell title={`${zoneName} — economics (rooftop PV)`}>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="CAPEX" value={formatEur(economics.capex)} />
        <Tile
          label="Annual savings"
          value={economics.annual > 0 ? `${formatEur(economics.annual)}/yr` : "—"}
        />
        <Tile label="Simple payback" value={paybackLabel(economics)} />
        <Tile label={`ROI, ${horizonYears}y`} value={roiLabel(economics, horizonYears)} />
      </div>
      <Footnote economics={economics} />
    </Shell>
  );
}

function BatteryEconomics({
  zoneId,
  zoneName,
  horizonYears,
}: {
  zoneId: string;
  zoneName: string;
  horizonYears: number;
}) {
  const query = useSpreadSeries(zoneId);
  const recent = useMemo(
    () => batteryEconomics(query.data?.recentAvg ?? null),
    [query.data?.recentAvg],
  );
  const forecast = useMemo(
    () => batteryEconomics(query.data?.forecastAvg ?? null),
    [query.data?.forecastAvg],
  );

  if (query.isPending) {
    return (
      <Shell title={`${zoneName} — economics (2 MWh battery)`}>
        <p className="mt-3 text-xs text-muted-foreground">Loading prices…</p>
      </Shell>
    );
  }
  if (!recent || !forecast) return null;

  return (
    <Shell title={`${zoneName} — economics (2 MWh battery)`}>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="CAPEX" value={formatEur(recent.capex)} />
        <Tile
          label="Annual revenue, recent"
          value={recent.annual > 0 ? `${formatEur(recent.annual)}/yr` : "—"}
        />
        <Tile label="Payback, recent 30d" value={paybackLabel(recent)} />
        <Tile label="Payback, forecast" value={paybackLabel(forecast)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Annual revenue, forecast"
          value={forecast.annual > 0 ? `${formatEur(forecast.annual)}/yr` : "—"}
        />
        <Tile label={`ROI, ${horizonYears}y recent`} value={roiLabel(recent, horizonYears)} />
        <Tile
          label={`ROI, ${horizonYears}y forecast`}
          value={roiLabel(forecast, horizonYears)}
        />
      </div>
      <Footnote economics={recent.assumptions.length > 0 ? recent : forecast} />
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Two cases: the average spread of the last 30 actual days, and the average of the
        90-day TimesFM forecast. Rough figures, not an investment case.
      </p>
    </Shell>
  );
}

export default function ZoneEconomics({
  play,
  zoneId,
  zoneName,
  breakdown,
  horizon,
}: {
  play: string;
  zoneId: string;
  zoneName: string;
  breakdown: Breakdown;
  horizon: string;
}) {
  const horizonYears = Number(horizon) || 1;

  if (play === "battery_storage") {
    return (
      <BatteryEconomics zoneId={zoneId} zoneName={zoneName} horizonYears={horizonYears} />
    );
  }
  if (play === "housing_energy") {
    return (
      <HousingEconomics
        breakdown={breakdown}
        zoneName={zoneName}
        horizonYears={horizonYears}
      />
    );
  }
  return null;
}
