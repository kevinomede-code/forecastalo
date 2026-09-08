import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AppSidebar from "@/components/AppSidebar";
import {
  colorFor,
  KG_KINDS,
  labelForKind,
  type KgEdge,
  type KgNode,
} from "@/lib/kg";

const KnowledgeGraph = lazy(() => import("@/components/KnowledgeGraph"));

export const Route = createFileRoute("/graph")({
  validateSearch: (search: Record<string, unknown>) => ({
    node: typeof search['node'] === "string" ? (search['node'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Knowledge Graph — Forecastalo Data, Methods and Limits" },
      {
        name: "description",
        content:
          "Explore how Forecastalo's data sources, indicators, scoring factors, models and declared limitations connect to each other.",
      },
      { property: "og:title", content: "Forecastalo Knowledge Graph" },
      {
        property: "og:description",
        content:
          "An Obsidian-style map of the sources, indicators, factors, methods and limits behind Forecastalo's scores.",
      },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(routeSearch.node ?? null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());

  // Allow linking straight to a note with /graph?node=slug
  useEffect(() => {
    if (routeSearch.node) {
      setSelected(routeSearch.node);
      setFocusNonce((n) => n + 1);
    }
  }, [routeSearch.node]);

  const query = useQuery({
    queryKey: ["kg"],
    queryFn: async () => {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from("kg_nodes").select("slug, title, kind, summary, detail, refs"),
        supabase.from("kg_edges").select("source_slug, target_slug, relation, note"),
      ]);
      if (nodesRes.error) throw nodesRes.error;
      if (edgesRes.error) throw edgesRes.error;
      return {
        nodes: (nodesRes.data ?? []) as unknown as KgNode[],
        edges: (edgesRes.data ?? []) as unknown as KgEdge[],
      };
    },
  });

  const nodes = query.data?.nodes ?? [];
  const edges = query.data?.edges ?? [];

  const bySlug = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);

  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.source_slug, (map.get(edge.source_slug) ?? 0) + 1);
      map.set(edge.target_slug, (map.get(edge.target_slug) ?? 0) + 1);
    }
    return map;
  }, [edges]);

  const node = selected ? bySlug.get(selected) ?? null : null;

  const connections = useMemo(() => {
    if (!selected) return [];
    const list: Array<{ relation: string; slug: string; title: string; kind: string }> = [];
    for (const edge of edges) {
      const other =
        edge.source_slug === selected
          ? edge.target_slug
          : edge.target_slug === selected
            ? edge.source_slug
            : null;
      if (!other) continue;
      const target = bySlug.get(other);
      if (!target) continue;
      list.push({
        relation: edge.relation,
        slug: target.slug,
        title: target.title,
        kind: target.kind,
      });
    }
    return list;
  }, [selected, edges, bySlug]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof connections>();
    for (const item of connections) {
      if (!map.has(item.relation)) map.set(item.relation, []);
      map.get(item.relation)!.push(item);
    }
    return Array.from(map.entries());
  }, [connections]);

  const starters = useMemo(
    () =>
      nodes
        .slice()
        .sort((a, b) => (degrees.get(b.slug) ?? 0) - (degrees.get(a.slug) ?? 0))
        .slice(0, 4),
    [nodes, degrees],
  );

  function pick(slug: string | null) {
    setSelected(slug);
    if (slug) setFocusNonce((n) => n + 1);
  }

  function toggleKind(kind: string) {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const refs =
    node?.refs && typeof node.refs === "object" && !Array.isArray(node.refs)
      ? Object.entries(node.refs as Record<string, unknown>).filter(
          ([, value]) => value !== null && typeof value !== "object",
        )
      : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopNav tagline="How the numbers behind the scores fit together" />

      <main className="flex min-h-0 flex-1 gap-5 p-5">
        <section className="flex min-h-0 w-[62%] flex-col gap-4">
          <div className="shrink-0 space-y-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes by title or summary…"
              className="rounded-xl"
            />
            <div className="flex flex-wrap gap-2">
              {KG_KINDS.map((kind) => {
                const off = hiddenKinds.has(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleKind(kind)}
                    className={`flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors ${
                      off ? "bg-muted text-muted-foreground/60" : "bg-card text-muted-foreground"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: off ? "#cbd5e1" : colorFor(kind) }}
                    />
                    {labelForKind(kind)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ClientOnly fallback={<GraphFallback label="Loading graph…" />}>
              <Suspense fallback={<GraphFallback label="Loading graph…" />}>
                {query.isPending ? (
                  <GraphFallback label="Loading notes…" />
                ) : query.isError ? (
                  <GraphFallback label="Could not load the knowledge graph." />
                ) : (
                  <KnowledgeGraph
                    nodes={nodes}
                    edges={edges}
                    selected={selected}
                    onSelect={pick}
                    search={search}
                    hiddenKinds={hiddenKinds}
                    focusNonce={focusNonce}
                  />
                )}
              </Suspense>
            </ClientOnly>
          </div>
        </section>

        <section className="min-h-0 w-[38%] overflow-y-auto rounded-2xl border border-border bg-panel p-5 shadow-soft">
          {!node ? (
            <div>
              <p className="text-sm font-medium">Pick a note</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click any circle in the graph to read the note behind it and follow its
                connections.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Good starting points
              </p>
              <ul className="mt-2 grid gap-2">
                {starters.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => pick(item.slug)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm shadow-soft transition-colors hover:border-highlight/40"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.summary}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                style={{ backgroundColor: colorFor(node.kind) }}
              >
                {labelForKind(node.kind)}
              </span>
              <h1 className="mt-3 text-lg font-semibold tracking-tight">{node.title}</h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {node.summary}
              </p>

              {node.detail ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-7">{node.detail}</p>
              ) : null}

              {refs.length > 0 ? (
                <dl className="mt-4 grid gap-1 rounded-xl bg-muted px-3 py-2">
                  {refs.map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-xs">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {grouped.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Connected
                  </p>
                  <div className="mt-2 grid gap-3">
                    {grouped.map(([relation, items]) => (
                      <div key={relation}>
                        <p className="text-xs italic text-muted-foreground">{relation}</p>
                        <ul className="mt-1 grid gap-1">
                          {items.map((item) => (
                            <li key={`${relation}-${item.slug}`}>
                              <button
                                type="button"
                                onClick={() => pick(item.slug)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                              >
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: colorFor(item.kind) }}
                                />
                                <span className="truncate">{item.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function GraphFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted shadow-soft">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
