import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { colorFor, type KgEdge, type KgNode } from "@/lib/kg";

type SimNode = SimulationNodeDatum & {
  slug: string;
  title: string;
  kind: string;
  summary: string;
  degree: number;
};

type SimLink = SimulationLinkDatum<SimNode> & { relation: string };

const WIDTH = 900;
const HEIGHT = 700;

function radiusFor(degree: number) {
  return Math.min(16, 6 + Math.sqrt(degree) * 3);
}

export default function KnowledgeGraph({
  nodes,
  edges,
  selected,
  onSelect,
  search,
  hiddenKinds,
  focusNonce,
}: {
  nodes: KgNode[];
  edges: KgEdge[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  search: string;
  hiddenKinds: Set<string>;
  focusNonce: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [, bump] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.source_slug, (map.get(edge.source_slug) ?? 0) + 1);
      map.set(edge.target_slug, (map.get(edge.target_slug) ?? 0) + 1);
    }
    return map;
  }, [edges]);

  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!map.has(edge.source_slug)) map.set(edge.source_slug, new Set());
      if (!map.has(edge.target_slug)) map.set(edge.target_slug, new Set());
      map.get(edge.source_slug)!.add(edge.target_slug);
      map.get(edge.target_slug)!.add(edge.source_slug);
    }
    return map;
  }, [edges]);

  // Build and run the simulation once per dataset, then stop ticking.
  useEffect(() => {
    if (nodes.length === 0) return;
    const simNodes: SimNode[] = nodes.map((node, i) => ({
      slug: node.slug,
      title: node.title,
      kind: node.kind,
      summary: node.summary,
      degree: degrees.get(node.slug) ?? 0,
      x: WIDTH / 2 + Math.cos(i) * 180,
      y: HEIGHT / 2 + Math.sin(i) * 180,
    }));
    const bySlug = new Map(simNodes.map((n) => [n.slug, n]));
    const simLinks: SimLink[] = edges
      .filter((e) => bySlug.has(e.source_slug) && bySlug.has(e.target_slug))
      .map((e) => ({
        source: bySlug.get(e.source_slug)!,
        target: bySlug.get(e.target_slug)!,
        relation: e.relation,
      }));

    nodesRef.current = simNodes;

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.slug)
          .distance(90)
          .strength(0.5),
      )
      .force("charge", forceManyBody<SimNode>().strength(-320))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radiusFor(d.degree) + 18),
      )
      .alphaDecay(0.03);

    let frame = 0;
    sim.on("tick", () => {
      frame += 1;
      if (frame % 3 === 0) bump((v) => v + 1);
    });
    sim.on("end", () => bump((v) => v + 1));
    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, edges, degrees]);

  // Pan and zoom.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        setTransform(event.transform);
      });
    select(svg).call(behaviour);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  // Centre the graph on the selected node when asked.
  useEffect(() => {
    if (!focusNonce || !selected) return;
    const node = nodesRef.current.find((n) => n.slug === selected);
    const svg = svgRef.current;
    if (!node || !svg || node.x == null || node.y == null) return;
    const scale = Math.max(transformRef.current.k, 1);
    const next = zoomIdentity
      .translate(WIDTH / 2 - node.x * scale, HEIGHT / 2 - node.y * scale)
      .scale(scale);
    transformRef.current = next;
    setTransform(next);
  }, [focusNonce, selected]);

  function resetView() {
    transformRef.current = zoomIdentity;
    setTransform(zoomIdentity);
  }

  function toGraphCoords(event: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    return transformRef.current.invert([x, y]);
  }

  function startDrag(node: SimNode, event: React.PointerEvent) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const sim = simRef.current;
    node.fx = node.x;
    node.fy = node.y;
    sim?.alphaTarget(0.15).restart();
  }

  function moveDrag(node: SimNode, event: React.PointerEvent) {
    if (node.fx == null) return;
    const point = toGraphCoords(event);
    if (!point) return;
    node.fx = point[0];
    node.fy = point[1];
    bump((v) => v + 1);
  }

  function endDrag(node: SimNode) {
    // Keep fx/fy so the node stays where it was dropped.
    if (node.fx == null) return;
    simRef.current?.alphaTarget(0);
    bump((v) => v + 1);
  }

  const term = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return null;
    return new Set(
      nodes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(term) || n.summary.toLowerCase().includes(term),
        )
        .map((n) => n.slug),
    );
  }, [nodes, term]);

  const active = hover ?? selected;
  const activeSet = active
    ? new Set<string>([active, ...(neighbours.get(active) ?? [])])
    : null;

  function visible(slug: string, kind: string) {
    return !hiddenKinds.has(kind) && (matches ? matches.has(slug) || !!activeSet?.has(slug) : true);
  }

  function nodeOpacity(node: SimNode) {
    if (hiddenKinds.has(node.kind)) return 0;
    if (activeSet) return activeSet.has(node.slug) ? 1 : 0.15;
    if (matches) return matches.has(node.slug) ? 1 : 0.15;
    return 1;
  }

  const simNodes = nodesRef.current;
  const bySlug = new Map(simNodes.map((n) => [n.slug, n]));
  const scale = transform.k;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none"
        onClick={() => onSelect(null)}
      >
        <g transform={transform.toString()}>
          {edges.map((edge, i) => {
            const source = bySlug.get(edge.source_slug);
            const target = bySlug.get(edge.target_slug);
            if (!source || !target) return null;
            if (!visible(source.slug, source.kind) || !visible(target.slug, target.kind))
              return null;
            const isActive =
              activeSet && (activeSet.has(source.slug) && activeSet.has(target.slug));
            return (
              <line
                key={i}
                x1={source.x ?? 0}
                y1={source.y ?? 0}
                x2={target.x ?? 0}
                y2={target.y ?? 0}
                stroke={isActive ? "#94a3b8" : "#cbd5e1"}
                strokeWidth={isActive ? 1.4 : 0.9}
                opacity={activeSet ? (isActive ? 0.95 : 0.15) : 0.7}
              />
            );
          })}

          {simNodes.map((node) => {
            const opacity = nodeOpacity(node);
            if (opacity === 0) return null;
            const r = radiusFor(node.degree);
            const showLabel = scale > 1.1 || node.degree >= 4 || activeSet?.has(node.slug);
            return (
              <g
                key={node.slug}
                transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                opacity={opacity}
                className="cursor-pointer"
                onPointerDown={(event) => startDrag(node, event)}
                onPointerMove={(event) => moveDrag(node, event)}
                onPointerUp={() => endDrag(node)}
                onPointerEnter={() => setHover(node.slug)}
                onPointerLeave={() => setHover(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.slug);
                }}
              >
                <circle
                  r={r}
                  fill={colorFor(node.kind)}
                  stroke={selected === node.slug ? "#1e293b" : "#ffffff"}
                  strokeWidth={selected === node.slug ? 2.5 : 1.5}
                />
                {showLabel ? (
                  <text
                    x={r + 5}
                    y={4}
                    fontSize={11}
                    fill="#475569"
                    style={{ pointerEvents: "none" }}
                  >
                    {node.title.length > 34 ? `${node.title.slice(0, 33)}…` : node.title}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      <button
        type="button"
        onClick={resetView}
        className="absolute right-3 top-3 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft transition-colors hover:text-foreground"
      >
        Reset view
      </button>
    </div>
  );
}
