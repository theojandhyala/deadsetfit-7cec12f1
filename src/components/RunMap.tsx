import { useEffect, useRef, useState } from "react";
import type { RunSample } from "@/lib/types";
import { samplesToSvgPath } from "@/lib/run";

interface RunMapProps {
  samples: RunSample[];
  height?: number;
  showMarkers?: boolean;
  live?: boolean;
  /** Force the lightweight SVG renderer (for thumbnails). */
  thumbnail?: boolean;
}

/**
 * Strava-style route renderer.
 *  - `thumbnail` mode: lightweight SVG polyline (used in history list).
 *  - default: real Leaflet map with OSM tiles + red polyline overlay.
 */
export function RunMap(props: RunMapProps) {
  if (props.thumbnail) return <SvgRoute {...props} />;
  return <LeafletRoute {...props} />;
}

/* ------------------------ SVG thumbnail ------------------------ */
function SvgRoute({
  samples,
  height = 80,
  showMarkers = false,
  live = false,
}: RunMapProps) {
  const { d, start, end } = samplesToSvgPath(samples);
  return (
    <div
      className="relative w-full bg-grit-card border border-grit overflow-hidden"
      style={{ height }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden
      >
        <defs>
          <pattern id="rmgrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1a1a1a" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#rmgrid)" />
      </svg>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full overflow-visible"
      >
        {d && (
          <>
            <path d={d} fill="none" stroke="#e63222" strokeOpacity={0.4}
              strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: "blur(1.5px)" }} />
            <path d={d} fill="none" stroke="#e63222"
              strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            {showMarkers && start && (
              <circle cx={start.x} cy={start.y} r={1.6} fill="#0a0a0a" stroke="#ffffff" strokeWidth={0.6} />
            )}
            {showMarkers && end && (
              <circle cx={end.x} cy={end.y} r={1.6} fill="#e63222" stroke="#ffffff" strokeWidth={0.6} />
            )}
          </>
        )}
      </svg>
      {samples.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="label-cap text-grit-dim text-[10px]">
            {live ? "GPS…" : "—"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------ Leaflet live map ------------------------ */
function LeafletRoute({
  samples,
  height = 280,
  live = false,
}: RunMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Init map (client-only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      // CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      const first = samples[0];
      const center: [number, number] = first
        ? [first.lat, first.lng]
        : [51.505, -0.09];

      const map = L.map(containerRef.current, {
        center,
        zoom: first ? 16 : 13,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update polyline + markers when samples change
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    const latlngs = samples.map((s) => [s.lat, s.lng] as [number, number]);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latlngs);
    } else if (latlngs.length >= 2) {
      polylineRef.current = L.polyline(latlngs, {
        color: "#e63222",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // Glow underlay
    if (!polylineRef.current?._glow && latlngs.length >= 2) {
      const glow = L.polyline(latlngs, {
        color: "#e63222",
        weight: 12,
        opacity: 0.18,
      }).addTo(map);
      if (polylineRef.current) polylineRef.current._glow = glow;
    } else if (polylineRef.current?._glow) {
      polylineRef.current._glow.setLatLngs(latlngs);
    }

    // Start marker
    if (latlngs.length >= 1) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = L.circleMarker(latlngs[0], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#0a0a0a",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        startMarkerRef.current.setLatLng(latlngs[0]);
      }
    }

    // End / current marker
    if (latlngs.length >= 1) {
      const last = latlngs[latlngs.length - 1];
      if (!endMarkerRef.current) {
        endMarkerRef.current = L.circleMarker(last, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#e63222",
          fillOpacity: 1,
          className: live ? "animate-pulse" : "",
        }).addTo(map);
      } else {
        endMarkerRef.current.setLatLng(last);
      }
    }

    // Fit / follow
    if (latlngs.length >= 2) {
      if (live) {
        // follow last point
        map.panTo(latlngs[latlngs.length - 1], { animate: true, duration: 0.5 });
      } else {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
      }
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0], 16);
    }
  }, [samples, ready, live]);

  return (
    <div
      className="relative w-full bg-grit-card border border-grit overflow-hidden"
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {samples.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40">
          <p className="label-cap text-grit-dim text-xs">
            {live ? "Acquiring GPS…" : "No route data"}
          </p>
        </div>
      )}
      {live && samples.length >= 2 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/80 border border-accent-red px-2 py-1 z-[400]">
          <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
          <span className="label-cap text-[9px] text-accent-red">LIVE</span>
        </div>
      )}
    </div>
  );
}
