import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(1).max(2000),
  play: z.string().min(1).max(64),
  level: z.enum(["province", "municipality", "market_zone"]),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(8)
    .default([]),
});

const SYSTEM_PROMPT = `You answer questions about Forecastalo, a tool that screens Italian provinces, municipalities and electricity market zones for housing and energy investment opportunities.

There are two scored plays.

PLAY 1 — "housing_energy", scored for 107 provinces and 1179 Piemonte municipalities:
  score = 100 × (0.30·solar + 0.25·market_size + 0.20·demographics + 0.25·building_stock)
Every factor is min-max normalised to 0–1 before weighting. Solar, market size and demographics are normalised separately for provinces and municipalities, because the two levels have very different scales. Building stock is normalised on the national distribution of provinces.

PLAY 2 — "battery_storage" (battery storage siting for price arbitrage), scored ONLY for the 7 Italian day-ahead market zones: Nord, Centro Nord, Centro Sud, Sud, Calabria, Sicilia, Sardegna. There is no provincial or municipal detail for this play, because day-ahead prices are set per zone and every point inside a zone sees the same price.
  score = 100 × (0.55·forecast_spread + 0.25·downside + 0.20·momentum)
Each factor is scaled against an ABSOLUTE threshold, not normalised across zones: full marks at 150 EUR/MWh predicted mean daily spread, full marks at 100 EUR/MWh for the downside (10th percentile of the forecast), and momentum mapped over the -10%..+30% range (forecast versus the last 12 months of actuals). Absolute thresholds were chosen because with only 7 zones a min-max normalisation lets a single outlier flatten all the others.

Indicators available:
- pv_yield_kwh_per_kwp — annual PV yield at optimal tilt, from PVGIS (JRC), 2024. Accounts for terrain horizon, so narrow valleys score low and high-altitude sites score high.
- irradiation_kwh_per_m2 — annual irradiation on the inclined plane, PVGIS, 2024.
- population — resident population 1 January, ISTAT, annual 2001–2026. Values before 2019 come from the intercensal reconstruction, spliced onto the current series at 2019.
- dwellings_pre1981_pct — share of dwellings built before 1981, ISTAT permanent census 2021. PROVINCE LEVEL ONLY: municipalities inherit their province's value, and the breakdown marks this with province_level = true.
- dwellings_total — total dwellings, ISTAT permanent census 2021, province level only.

Market-zone price indicators, daily from 2016 to 2026-08-31 (market zones only):
- price_min_eur_mwh, price_max_eur_mwh, price_avg_eur_mwh — daily day-ahead price minimum, maximum and average. price_max_eur_mwh is the price LEVEL.
- price_spread_eur_mwh — daily max minus min: the arbitrage revenue a battery can capture in one cycle.
- price_spread_pct and price_shape_ratio — price_shape_ratio = 1 − min/max, bounded 0 to 1, measuring how deep the midday price collapse is. Level × shape is exactly the daily spread: price_max_eur_mwh × price_shape_ratio = price_spread_eur_mwh.

Forecasts: price_max_eur_mwh, price_shape_ratio and price_spread_eur_mwh, daily from 2026-09-01 to 2026-11-29, model_version 'timesfm-3.0', with lower_bound and upper_bound. Horizon 90 days. In a rolling backtest over 4 windows TimesFM 3.0 beat persistence, seasonal and trailing-mean baselines in 3 of 4 windows, averaging 29.9 EUR/MWh MAE against 37.1 for the best baseline — roughly a third of relative error. Good enough for RANKING zones, not for financial precision.

Known limitations you must be honest about when relevant:
- Building stock is only available per province, so any municipal answer about building age is really about its province.
- The weights are a working assumption, not a calibrated model.
- Energy performance certificate data (SIAPE) and property prices (OMI) are not in the dataset.
- The battery storage score contains NO grid connection data, NO local PV saturation and NO permitting or land cost — and those are decisive for actually siting a battery. Prices are zonal, so there is no sub-zonal precision whatsoever. Say this plainly whenever someone asks where to put a battery: the score ranks which market zone is worth studying, it does not pick a site.

Knowledge graph: the context also contains a "knowledge_graph" object. "knowledge_graph.matched" holds curated notes about this project's data sources, indicators, plays, scoring factors, models, methods, findings and declared limitations, each with a title, kind and summary (and sometimes longer detail and refs). "knowledge_graph.related" holds the notes directly connected to those, each with the relation verb that links them. Use these notes to answer "why" and "how" questions — why a weight was chosen, where a number comes from, which method produced it, what is deliberately missing from a score — and quote the note titles when you rely on them. The notes explain reasoning; they never override the numbers.

Rules: use only the data provided in the context. Never invent a number. If the context does not contain what is needed, say plainly what is missing. Quote concrete figures with their units when you have them. Be concise and direct — a few sentences, not an essay. Answer in the language of the question.`;


const STOP_WORDS = new Set([
  "why","does","score","higher","than","which","provinces","have","the","oldest",
  "building","stock","but","weak","solar","what","factor","actually","measure",
  "and","for","with","from","this","that","best","worst","how","are","most",
  "municipalities","province","municipality","italy","piemonte","compare","between",
  "perche","quale","quali","come","cosa","dove","meglio","peggio","punteggio",
]);

function candidateNames(question: string): string[] {
  const words = question
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));
  return Array.from(new Set(words)).slice(0, 8);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const askQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { answer: null, error: "The AI assistant is not configured yet." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { streamText } = await import("ai");

    const { question, play, level, history } = data;

    // ---- 1. Zones mentioned in the question -------------------------------
    const names = candidateNames(question);
    let matchedZones: Array<{ id: string; name: string; level: string; region: string | null }> = [];
    if (names.length > 0) {
      const orFilter = names.map((n) => `name.ilike.%${n.replace(/[,%]/g, "")}%`).join(",");
      const { data: zoneRows } = await supabaseAdmin
        .from("zones")
        .select("id, name, level, region")
        .or(orFilter)
        .limit(6);
      matchedZones = zoneRows ?? [];
    }

    const zoneDetails: unknown[] = [];
    for (const zone of matchedZones) {
      const [{ data: scoreRows }, { data: indicatorRows }] = await Promise.all([
        supabaseAdmin
          .from("scores")
          .select("score_total, breakdown, recommendation, play")
          .eq("zone_id", zone.id)
          .eq("play", play)
          .limit(1),
        supabaseAdmin
          .from("indicators")
          .select("indicator_code, period, value, unit")
          .eq("zone_id", zone.id)
          .order("period", { ascending: false })
          .limit(200),
      ]);

      const latest: Record<string, { value: number | null; unit: string | null; period: string }> = {};
      const population: Record<string, number | null> = {};
      for (const row of indicatorRows ?? []) {
        if (!latest[row.indicator_code]) {
          latest[row.indicator_code] = {
            value: row.value === null ? null : round(Number(row.value)),
            unit: row.unit,
            period: row.period,
          };
        }
        if (row.indicator_code === "population") {
          const year = String(row.period).slice(0, 4);
          if (["2001", "2016", "2026"].includes(year)) {
            population[year] = row.value === null ? null : Number(row.value);
          }
        }
      }

      zoneDetails.push({
        name: zone.name,
        level: zone.level,
        region: zone.region,
        score: scoreRows?.[0]
          ? {
              score_total: scoreRows[0].score_total,
              breakdown: scoreRows[0].breakdown,
              recommendation: scoreRows[0].recommendation,
            }
          : null,
        latest_indicators: latest,
        population_trend: population,
      });
    }

    // ---- 2. General context for the selected level ------------------------
    const { data: topRows } = await supabaseAdmin
      .from("scores")
      .select("score_total, breakdown, recommendation, zones!inner(name, level)")
      .eq("play", play)
      .eq("zones.level", level)
      .order("score_total", { ascending: false })
      .limit(15);

    const { data: statsData } = await supabaseAdmin.rpc("context_stats", {
      p_play: play,
      p_level: level,
    });

    const context = {
      play,
      level,
      zones_mentioned_in_question: zoneDetails,
      top_zones_by_score: (topRows ?? []).map((row) => ({
        name: (row as unknown as { zones: { name: string } }).zones?.name,
        score_total: row.score_total,
        breakdown: row.breakdown,
        recommendation: row.recommendation,
      })),
      summary: statsData ?? {
        zones_scored: 0,
        score: {},
        indicators: {},
      },
    };

    try {
      const gateway = createLovableAiGatewayProvider(apiKey);
      const result = streamText({
        model: gateway("google/gemini-3.7-flash"),
        system: SYSTEM_PROMPT,
        messages: [
          ...history,
          {
            role: "user" as const,
            content: `Context (JSON, the only data you may use):\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
          },
        ],
      });
      const answer = await result.text;
      return { answer: answer.trim(), error: null };
    } catch (error) {
      console.error("[ask] gateway error", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("402")) {
        return { answer: null, error: "AI credits are exhausted. Please top up to keep asking." };
      }
      if (message.includes("429")) {
        return { answer: null, error: "Too many questions at once — please try again in a moment." };
      }
      return { answer: null, error: "The assistant could not answer right now." };
    }
  });
