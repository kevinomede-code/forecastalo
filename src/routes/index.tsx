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

type ScoreRow = {
  id: string;
  play: string;
  score_total: number | null;
  recommendation: string | null;
  zones: { name: string } | null;
};

const PLAYS = [
  { value: "housing_energy", label: "Housing + Energy (PV + heat pump)", disabled: false },
  { value: "ev_charging", label: "EV Charging & Mobility", disabled: true },
  { value: "energy_community", label: "Energy Community", disabled: true },
];

function Index() {
  const [play, setPlay] = useState("housing_energy");
  const [geography, setGeography] = useState("provinces_italy");
  const [horizon, setHorizon] = useState("3");
  const [request, setRequest] = useState<{ play: string; nonce: number } | null>(null);

  const query = useQuery({
    queryKey: ["scores", request?.play, request?.nonce],
    enabled: request !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scores")
        .select("id, play, score_total, recommendation, zones(name)")
        .eq("play", request!.play)
        .order("score_total", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreRow[];
    },
  });

  const results = query.data ?? [];

  let systemMessage = "Ready.";
  if (query.isFetching) systemMessage = "Calculating…";
  else if (query.isError) systemMessage = "Could not load scores. Please try again.";
  else if (request && results.length > 0)
    systemMessage = `${results.length} zones scored.`;
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
                <Select value={play} onValueChange={setPlay}>
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
                      <SelectItem value="provinces_italy">Provinces — Italy</SelectItem>
                      <SelectItem value="municipalities_piemonte">
                        Municipalities — Piemonte
                      </SelectItem>
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
                onClick={() => setRequest({ play, nonce: Date.now() })}
              >
                Calculate
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-panel shadow-soft">
            <p className="shrink-0 border-b border-border px-5 py-3 text-sm text-muted-foreground">
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
                {results.map((row, i) => {
                  const score = row.score_total ?? 0;
                  const high = score >= 70;
                  return (
                    <li
                      key={row.id}
                      className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-soft"
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
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
                      <p className="mt-2 text-sm text-muted-foreground">
                        {row.recommendation ?? "No recommendation available."}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="min-h-0 w-[60%]">
          <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted shadow-soft">
            <span className="text-sm font-medium text-muted-foreground">Map</span>
          </div>
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
