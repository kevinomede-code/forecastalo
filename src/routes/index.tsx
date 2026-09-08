import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MapFocus, ScoreRow } from "@/lib/score-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AskPanel from "@/components/AskPanel";
import BreakdownList from "@/components/BreakdownList";
import SpreadChart from "@/components/SpreadChart";


const ScoreMap = lazy(() => import("@/components/ScoreMap"));



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forecastalo — Housing & Energy Investment Screening in Italy" },
      {
        name: "description",
        content:
          "Screen Italian provinces and municipalities for housing and energy investment opportunities with forecast-driven scores.",
      },
      {
        property: "og:title",
        content: "Forecastalo — Investment Screening for Italy",
      },
      {
        property: "og:description",
        content:
          "Where to invest in housing and energy across Italy: forecast-driven zone scores.",
      },
    ],
  }),
  component: Index,
});

const PLAYS = [
  { value: "housing_energy", label: "Housing + Energy (PV + heat pump)", disabled: false },
  { value: "battery_storage", label: "Battery storage (arbitrage)", disabled: false },
  { value: "ev_charging", label: "EV Charging & Mobility", disabled: true },
  { value: "energy_community", label: "Energy Community", disabled: true },
];

const GEOGRAPHIES: Record<
  string,
  Array<{ value: string; label: string; level: string }>
> = {
  housing_energy: [
    { value: "provinces_italy", label: "Provinces — Italy", level: "province" },
    {
      value: "municipalities_piemonte",
      label: "Municipalities — Piemonte",
      level: "municipality",
    },
  ],
  battery_storage: [
    { value: "market_zones_italy", label: "Market zones — Italy", level: "market_zone" },
  ],
};

function levelFor(play: string, geography: string) {
  const options = GEOGRAPHIES[play] ?? GEOGRAPHIES['housing_energy']!;
  return (options.find((o) => o.value === geography) ?? options[0]!).level;
}

const PAGE_SIZE = 1000;

function Index() {
  const [play, setPlay] = useState("housing_energy");
  const [geography, setGeography] = useState("provinces_italy");
  const [horizon, setHorizon] = useState("3");
  const [request, setRequest] = useState<{
    play: string;
    geography: string;
    nonce: number;
  } | null>(null);
  const [focus, setFocus] = useState<MapFocus>(null);
  const [selected, setSelected] = useState<ScoreRow | null>(null);

  const geographyOptions = GEOGRAPHIES[play] ?? GEOGRAPHIES['housing_energy']!;

  function changePlay(next: string) {
    setPlay(next);
    setGeography((GEOGRAPHIES[next] ?? GEOGRAPHIES['housing_energy']!)[0]!.value);
    setRequest(null);
    setFocus(null);
    setSelected(null);
  }


  const query = useQuery({
    queryKey: ["scores", request?.play, request?.geography, request?.nonce],
    enabled: request !== null,
    queryFn: async () => {
      const level = levelFor(request!.play, request!.geography);
      const all: ScoreRow[] = [];
      // Supabase caps responses at 1000 rows, so page through the results.
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("scores")
          .select(
            "zone_id, score_total, breakdown, recommendation, zones!inner(name, level, latitude, longitude)",
          )
          .eq("play", request!.play)
          .eq("zones.level", level)
          .order("score_total", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as ScoreRow[];
        all.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      return all;
    },
  });

  const results = query.data ?? [];
  const topResults = results.slice(0, 50);
  const isMarketZone = levelFor(play, geography) === "market_zone";


  let systemMessage = "Ready.";
  if (query.isFetching) systemMessage = "Calculating…";
  else if (query.isError) systemMessage = "Could not load scores. Please try again.";
  else if (request && results.length > 0)
    systemMessage = `${results.length} zones scored — showing top ${topResults.length}.`;
  else if (request) systemMessage = "No scores yet.";


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-baseline gap-4 border-b border-border bg-card px-6 py-3">
        <span className="text-base font-semibold tracking-tight">Forecastalo</span>
        <span className="truncate text-sm text-muted-foreground">
          Where to invest in housing and energy across Italy
        </span>
      </header>

      <main className="flex min-h-0 flex-1 gap-5 p-5">
        <section className="flex min-h-0 w-[40%] flex-col gap-5">
          <div className="shrink-0 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="grid gap-4">
              <Field label="Investment play">
                <Select value={play} onValueChange={changePlay}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYS.map((p) => (
                      <SelectItem key={p.value} value={p.value} disabled={p.disabled}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Geography">
                  <Select value={geography} onValueChange={setGeography}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {geographyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>


                <Field label="Horizon">
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 year</SelectItem>
                      <SelectItem value="3">3 years</SelectItem>
                      <SelectItem value="5">5 years</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Button
                className="w-full rounded-xl"
                disabled={query.isFetching}
                onClick={() => setRequest({ play, geography, nonce: Date.now() })}
              >
                Calculate
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-panel shadow-soft">
            <Tabs
              defaultValue="results"
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <TabsList className="mx-4 mt-3 h-auto shrink-0 self-start rounded-xl bg-muted p-1">
                <TabsTrigger value="results" className="rounded-lg px-3 py-1 text-xs">
                  Results
                </TabsTrigger>
                <TabsTrigger value="ask" className="rounded-lg px-3 py-1 text-xs">
                  Ask
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="results"
                className="mt-3 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
              >
                <p className="shrink-0 border-y border-border px-5 py-3 text-sm text-muted-foreground">
                  {systemMessage}
                </p>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {request && !query.isFetching && !query.isError && results.length === 0 ? (
                    <div className="mx-auto mt-10 max-w-xs text-center">
                      <p className="text-sm font-medium">No scores computed yet</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The database is set up, but no zones have been scored so far. Results
                        will appear here once data is loaded.
                      </p>
                    </div>
                  ) : null}

                  <ul className="grid gap-3">
                    {topResults.map((row, i) => {
                      const score = row.score_total ?? 0;
                      const high = score >= 70;
                      return (
                        <li
                          key={row.zone_id}
                          className="animate-fade-in-up cursor-pointer rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-highlight/40"
                          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                          onClick={() => {
                            setFocus({ zoneId: row.zone_id, nonce: Date.now() });
                            setSelected(row);
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">
                              {row.zones?.name ?? "Unknown zone"}
                            </span>
                            <span
                              className={
                                high
                                  ? "rounded-full bg-highlight-soft px-2.5 py-1 text-xs font-semibold text-highlight"
                                  : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                              }
                            >
                              {score.toFixed(1)}
                            </span>
                          </div>
                          <BreakdownList breakdown={row.breakdown} />
                          <p className="mt-2 text-sm text-muted-foreground">
                            {row.recommendation ?? "No recommendation available."}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent
                value="ask"
                className="mt-3 flex min-h-0 flex-1 flex-col border-t border-border data-[state=inactive]:hidden"
              >
                <AskPanel
                  play={play}
                  level={
                    levelFor(play, geography) as "province" | "municipality" | "market_zone"
                  }
                />
              </TabsContent>
            </Tabs>
          </div>

          {isMarketZone && selected?.zones ? (
            <SpreadChart zoneId={selected.zone_id} zoneName={selected.zones.name} />
          ) : null}

        </section>

        <section className="min-h-0 w-[60%]">
          <ClientOnly
            fallback={
              <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted shadow-soft">
                <span className="text-sm font-medium text-muted-foreground">Map</span>
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted shadow-soft">
                  <span className="text-sm font-medium text-muted-foreground">Map</span>
                </div>
              }
            >
              <ScoreMap
                rows={results}
                focus={focus}
                clustered={!isMarketZone}
                onSelectZone={(zoneId: string) =>
                  setSelected(results.find((r) => r.zone_id === zoneId) ?? null)
                }

              />
            </Suspense>
          </ClientOnly>


        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
