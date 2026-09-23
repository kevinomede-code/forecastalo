import type { Breakdown } from "@/lib/score-types";

// Rough, deliberately simple investment economics. No discounting, no
// degradation, no O&M — every input is either a stated constant below or a
// value already present in the score breakdown / price data.

export const PV_SYSTEM_KWP = 6;
export const PV_CAPEX_PER_KWP = 1800;
// No-storage system: without a battery a residential rooftop in Italy
// self-consumes roughly 25–35% of production; 60% is only reached with storage,
// which the CAPEX above does not cover.
export const PV_SELF_CONSUMPTION = 0.35;
export const PV_RETAIL_TARIFF_EUR_PER_KWH = 0.3;

export const BATTERY_ENERGY_KWH = 2000; // 2 MWh / 2 h
export const BATTERY_CAPEX_PER_KWH = 250;
export const BATTERY_ROUND_TRIP = 0.88;
export const BATTERY_SPREAD_CAPTURE = 0.5;
export const BATTERY_CYCLES_PER_YEAR = 365;

export type Economics = {
  capex: number;
  annual: number;
  paybackYears: number | null;
  assumptions: string[];
  missing: string[];
};

export function roiPct(economics: Economics, horizonYears: number): number {
  return ((economics.annual * horizonYears - economics.capex) / economics.capex) * 100;
}

function partValue(breakdown: Breakdown, key: string): number | null {
  const part = (breakdown ?? {})[key];
  if (typeof part !== "object" || part === null) return null;
  const value = (part as Record<string, unknown>)["value"];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function housingEconomics(breakdown: Breakdown): Economics | null {
  const yieldPerKwp = partValue(breakdown, "solar");
  const capex = PV_SYSTEM_KWP * PV_CAPEX_PER_KWP;
  if (yieldPerKwp == null) {
    return {
      capex,
      annual: 0,
      paybackYears: null,
      assumptions: [],
      missing: ["PV yield (kWh/kWp/year) is not available for this zone."],
    };
  }

  const production = PV_SYSTEM_KWP * yieldPerKwp;
  const annual = production * PV_SELF_CONSUMPTION * PV_RETAIL_TARIFF_EUR_PER_KWH;

  return {
    capex,
    annual,
    paybackYears: annual > 0 ? capex / annual : null,
    assumptions: [
      `${PV_SYSTEM_KWP} kWp rooftop system at ${PV_CAPEX_PER_KWP.toLocaleString("en-GB")} €/kWp`,
      `${Math.round(yieldPerKwp)} kWh/kWp/year yield (PVGIS) → ${Math.round(production).toLocaleString("en-GB")} kWh/year`,
      `${Math.round(PV_SELF_CONSUMPTION * 100)}% self-consumption at a stated retail tariff of ${PV_RETAIL_TARIFF_EUR_PER_KWH.toFixed(2)} €/kWh`,
      "A battery would raise self-consumption to roughly 60% and cut the payback by about a third, but it is not costed here — the CAPEX above covers panels and inverter only",
      "No discounting, no panel degradation, no maintenance cost",
    ],
    missing: [
      "Heat pump savings are not modelled — the database has no heating-demand data yet.",
    ],
  };
}

export function batteryEconomics(spreadEurPerMwh: number | null): Economics | null {
  const capex = BATTERY_ENERGY_KWH * BATTERY_CAPEX_PER_KWH;
  if (spreadEurPerMwh == null) {
    return {
      capex,
      annual: 0,
      paybackYears: null,
      assumptions: [],
      missing: ["No price spread available for this zone."],
    };
  }

  const energyMwh = BATTERY_ENERGY_KWH / 1000;
  const perCycle =
    spreadEurPerMwh * BATTERY_SPREAD_CAPTURE * BATTERY_ROUND_TRIP * energyMwh;
  const annual = perCycle * BATTERY_CYCLES_PER_YEAR;

  return {
    capex,
    annual,
    paybackYears: annual > 0 ? capex / annual : null,
    assumptions: [
      `${energyMwh} MWh / 2 h battery at ${BATTERY_CAPEX_PER_KWH} €/kWh`,
      `${spreadEurPerMwh.toFixed(1)} €/MWh daily spread, ${Math.round(BATTERY_SPREAD_CAPTURE * 100)}% captured, ${Math.round(BATTERY_ROUND_TRIP * 100)}% round-trip efficiency`,
      `${BATTERY_CYCLES_PER_YEAR} cycles per year (1 per day)`,
      "Energy arbitrage only — no capacity market, no ancillary services, no grid fees",
    ],
    missing: [],
  };
}

export function formatEur(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("en-GB")} €`;
}
