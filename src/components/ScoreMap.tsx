import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { MapFocus, ScoreRow } from "@/lib/score-types";
import { formatPart, formatWeight, parseBreakdown } from "@/lib/score-types";


const SCORE_RAMP = [
  "interpolate",
  ["linear"],
  ["get", "score"],
  30,
  "#cbd5e1",
  45,
  "#93c5fd",
  60,
  "#60a5fa",
  70,
  "#3b82f6",
  80,
  "#1d4ed8",
] as unknown as mapboxgl.ExpressionSpecification;

const CLUSTER_RAMP = [
  "interpolate",
  ["linear"],
  ["/", ["get", "score_sum"], ["get", "point_count"]],
  30,
  "#cbd5e1",
  45,
  "#93c5fd",
  60,
  "#60a5fa",
  70,
  "#3b82f6",
  80,
  "#1d4ed8",
] as unknown as mapboxgl.ExpressionSpecification;

const SOURCE_ID = "zones";

function toGeoJSON(rows: ScoreRow[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows
      .filter((r) => r.zones?.longitude != null && r.zones?.latitude != null)
      .map((r) => ({
        type: "Feature" as const,
        id: undefined,
        geometry: {
          type: "Point" as const,
          coordinates: [Number(r.zones!.longitude), Number(r.zones!.latitude)],
        },
        properties: {
          zone_id: r.zone_id,
          name: r.zones!.name,
          score: Number(r.score_total ?? 0),
          recommendation: r.recommendation ?? "",
          breakdown: JSON.stringify(r.breakdown ?? {}),
        },
      })),
  };
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function popupHtml(props: Record<string, unknown>) {
  let breakdown: Record<string, unknown> | null = null;
  try {
    breakdown = JSON.parse(String(props['breakdown'] ?? "{}")) as Record<string, unknown>;
  } catch {
    breakdown = null;
  }

  const { factors, context, missing } = parseBreakdown(breakdown);

  const rowsHtml = factors
    .map(
      ([label, part]) => `<div class="flex items-baseline justify-between gap-4 border-t border-border py-1.5">
        <span class="text-xs font-medium text-muted-foreground">${esc(label)}</span>
        <span class="text-right text-xs"><span class="font-medium text-foreground">${esc(formatPart(part))}</span>
        <span class="ml-2 text-muted-foreground">${esc(formatWeight(part))}</span></span>
      </div>`,
    )
    .join("");

  const contextHtml = context.length
    ? `<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">${context
        .map(
          ([label, value]) =>
            `<span class="text-[11px] text-muted-foreground">${esc(label)}: <span class="text-foreground">${esc(value)}</span></span>`,
        )
        .join("")}</div>`
    : "";

  const missingHtml = missing.length
    ? `<div class="mt-2 rounded-lg bg-muted px-3 py-2">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Not included in this score</p>
        <ul class="mt-1">${missing.map((item) => `<li class="text-xs text-muted-foreground">• ${esc(item)}</li>`).join("")}</ul>
      </div>`
    : "";

  const score = Number(props['score'] ?? 0);
  const recommendation = String(props['recommendation'] ?? "");

  return `<div class="min-w-[15rem] max-w-[18rem] p-1">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-foreground">${esc(String(props['name'] ?? ""))}</h3>
      <span class="rounded-full bg-highlight-soft px-2.5 py-1 text-sm font-semibold text-highlight">${score.toFixed(1)}</span>
    </div>
    <div class="mt-3">${rowsHtml}${contextHtml}${missingHtml}</div>
    ${recommendation ? `<p class="mt-3 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">${esc(recommendation)}</p>` : ""}
  </div>`;
}


export default function ScoreMap({ rows, focus }: { rows: ScoreRow[]; focus: MapFocus }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const readyRef = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const token = import.meta.env['VITE_MAPBOX_TOKEN'] as string | undefined;

  useEffect(() => {
    if (!token || !container.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [12.5, 42.5],
      zoom: 5,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "20rem",
      className: "forecastalo-popup",
    });
    popupRef.current = popup;

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toGeoJSON(rowsRef.current),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 9,
        clusterProperties: { score_sum: ["+", ["get", "score"]] },
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": CLUSTER_RAMP,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,
            14,
            25,
            20,
            100,
            28,
            500,
            36,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": SCORE_RAMP,
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      readyRef.current = true;
      map.resize();
    });

    map.on("click", "clusters", (e) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0] as unknown as Feature<Point> | undefined;
      if (!feature) return;
      const clusterId = feature.properties?.['cluster_id'];
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        map.easeTo({
          center: (feature.geometry as Point).coordinates as [number, number],
          zoom,
          duration: 600,
        });
      });
    });

    map.on("click", "points", (e) => {
      const feature = e.features?.[0] as unknown as Feature<Point> | undefined;
      if (!feature) return;
      popup
        .setLngLat((feature.geometry as Point).coordinates as [number, number])
        .setHTML(popupHtml(feature.properties ?? {}))
        .addTo(map);
    });

    map.on("mouseenter", "points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "points", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, [token]);

  // Update data in place
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(toGeoJSON(rows));
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [rows]);

  // Fly to a zone selected in the list
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const row = rows.find((r) => r.zone_id === focus.zoneId);
    if (!row?.zones || row.zones.longitude == null || row.zones.latitude == null) return;
    const coords: [number, number] = [Number(row.zones.longitude), Number(row.zones.latitude)];
    map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 10), duration: 1200, essential: true });
    popupRef.current
      ?.setLngLat(coords)
      .setHTML(
        popupHtml({
          name: row.zones.name,
          score: row.score_total ?? 0,
          recommendation: row.recommendation ?? "",
          breakdown: JSON.stringify(row.breakdown ?? {}),
        }),
      )
      .addTo(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted p-8 shadow-soft">
        <div className="max-w-xs text-center">
          <p className="text-sm font-medium text-foreground">Map needs a Mapbox token</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a Mapbox access token to show the interactive map. Everything else keeps working.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-2xl border border-border bg-muted shadow-soft">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
