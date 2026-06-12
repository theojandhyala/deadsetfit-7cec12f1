import { useEffect, useRef, useState } from "react";
import type { RunSample } from "@/lib/types";
import { samplesToSvgPath } from "@/lib/run";

interface RunMapProps {
  samples: RunSample[];
  height?: number;
  showMarkers?: boolean;
  live?: boolean;
  thumbnail?: boolean;
  mapStyle?: "dark" | "trail";
  activityColor?: string;
}

export function RunMap(props: RunMapProps) {
  if (props.thumbnail) return <SvgRoute {...props} />;
  return <MapLibreRoute {...props} />;
}

const DEFAULT_COLOR = "#E10600";

/* ─── SVG thumbnail ──────────────────────────────────────────── */
function SvgRoute({
  samples,
  height = 80,
  showMarkers = false,
  live = false,
  activityColor = DEFAULT_COLOR,
}: RunMapProps) {
  const { d, start, end } = samplesToSvgPath(samples);
  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: "#0A0A0A" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <pattern id="rmgrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#141414" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#rmgrid)" />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full overflow-visible">
        {d && (
          <>
            <path d={d} fill="none" stroke={activityColor} strokeOpacity={0.35} strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round" style={{ filter: "blur(2px)" }} />
            <path d={d} fill="none" stroke={activityColor} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
            {showMarkers && start && (
              <circle cx={start.x} cy={start.y} r={2} fill="#0A0A0A" stroke="#fff" strokeWidth={0.8} />
            )}
            {showMarkers && end && (
              <circle cx={end.x} cy={end.y} r={2} fill={activityColor} stroke="#fff" strokeWidth={0.8} />
            )}
          </>
        )}
      </svg>
      {samples.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="label-cap text-[10px]" style={{ color: "#8A8A8A" }}>{live ? "GPS…" : "—"}</p>
        </div>
      )}
    </div>
  );
}

/* ─── MapLibre GL live map ───────────────────────────────────── */
const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

function MapLibreRoute({
  samples,
  height = 280,
  live = false,
  activityColor = DEFAULT_COLOR,
}: RunMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const colorRef = useRef(activityColor);
  colorRef.current = activityColor;

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mlgl = await import("maplibre-gl");
      const maplibregl = mlgl.default ?? mlgl;

      // Inject CSS once
      if (!document.getElementById("maplibre-css")) {
        const link = document.createElement("link");
        link.id = "maplibre-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      const first = samples[0];
      const center: [number, number] = first ? [first.lng, first.lat] : [0, 20];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center,
        zoom: first ? 15 : 2,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });

      map.on("load", () => {
        if (cancelled) return;

        // Route glow layer
        map.addSource("route", {
          type: "geojson",
          data: buildGeoJSON(samples),
        });
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colorRef.current,
            "line-width": 14,
            "line-opacity": 0.2,
            "line-blur": 6,
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colorRef.current,
            "line-width": 4,
            "line-opacity": 0.95,
          },
        });

        // Start dot
        map.addSource("start-pt", {
          type: "geojson",
          data: buildPoint(samples[0] ?? null),
        });
        map.addLayer({
          id: "start-dot",
          type: "circle",
          source: "start-pt",
          paint: {
            "circle-radius": 7,
            "circle-color": "#0A0A0A",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        // End dot (current position)
        map.addSource("end-pt", {
          type: "geojson",
          data: buildPoint(samples[samples.length - 1] ?? null),
        });
        map.addLayer({
          id: "end-dot",
          type: "circle",
          source: "end-pt",
          paint: {
            "circle-radius": 9,
            "circle-color": colorRef.current,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        fitMap(map, samples, live);
        mapRef.current = map;
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update route + color
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    (map.getSource("route") as any)?.setData(buildGeoJSON(samples));
    (map.getSource("end-pt") as any)?.setData(buildPoint(samples[samples.length - 1] ?? null));
    (map.getSource("start-pt") as any)?.setData(buildPoint(samples[0] ?? null));

    map.setPaintProperty("route-line", "line-color", activityColor);
    map.setPaintProperty("route-glow", "line-color", activityColor);
    map.setPaintProperty("end-dot", "circle-color", activityColor);

    fitMap(map, samples, live);
  }, [samples, ready, live, activityColor]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {samples.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(10,10,10,0.6)" }}>
          <p className="label-cap text-xs" style={{ color: "#8A8A8A" }}>
            {live ? "Acquiring GPS…" : "No route data"}
          </p>
        </div>
      )}
      {live && samples.length >= 2 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 z-10"
          style={{ background: "rgba(0,0,0,0.85)", border: "1px solid #E10600" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FF1A1A" }} />
          <span className="label-cap text-[9px]" style={{ color: "#FF1A1A" }}>LIVE</span>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */
function buildGeoJSON(samples: RunSample[]) {
  return {
    type: "FeatureCollection" as const,
    features: samples.length >= 2
      ? [{
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: samples.map((s) => [s.lng, s.lat]),
          },
        }]
      : [],
  };
}

function buildPoint(s: RunSample | null) {
  return {
    type: "FeatureCollection" as const,
    features: s
      ? [{
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        }]
      : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitMap(map: any, samples: RunSample[], live: boolean) {
  if (samples.length === 0) return;
  if (live) {
    const last = samples[samples.length - 1];
    map.easeTo({ center: [last.lng, last.lat], duration: 400 });
    return;
  }
  if (samples.length === 1) {
    map.flyTo({ center: [samples[0].lng, samples[0].lat], zoom: 15 });
    return;
  }
  const lngs = samples.map((s) => s.lng);
  const lats = samples.map((s) => s.lat);
  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 40, maxZoom: 17, animate: false },
  );
}
