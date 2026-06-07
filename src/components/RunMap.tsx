import type { RunSample } from "@/lib/types";
import { samplesToSvgPath } from "@/lib/run";

interface RunMapProps {
  samples: RunSample[];
  height?: number;
  showMarkers?: boolean;
  live?: boolean;
}

/**
 * Lightweight Strava-style route renderer. Draws the GPS trail as a stylized
 * polyline on a dark gridded backdrop. No external map dependency.
 */
export function RunMap({ samples, height = 240, showMarkers = true, live = false }: RunMapProps) {
  const { d, start, end } = samplesToSvgPath(samples);

  return (
    <div
      className="relative w-full bg-grit-card border border-grit overflow-hidden"
      style={{ height }}
    >
      {/* Grid backdrop */}
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
          <linearGradient id="rmtrail" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e63222" />
            <stop offset="100%" stopColor="#ff5a3c" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#rmgrid)" />
      </svg>

      {/* Route */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full overflow-visible"
      >
        {d && (
          <>
            {/* Glow */}
            <path
              d={d}
              fill="none"
              stroke="#e63222"
              strokeOpacity={0.35}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "blur(1.5px)" }}
            />
            <path
              d={d}
              fill="none"
              stroke="url(#rmtrail)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showMarkers && start && (
              <g>
                <circle cx={start.x} cy={start.y} r={1.6} fill="#0a0a0a" stroke="#ffffff" strokeWidth={0.6} />
              </g>
            )}
            {showMarkers && end && (
              <g>
                {live ? (
                  <>
                    <circle cx={end.x} cy={end.y} r={3} fill="#e63222" opacity={0.35}>
                      <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={end.x} cy={end.y} r={1.6} fill="#e63222" stroke="#ffffff" strokeWidth={0.6} />
                  </>
                ) : (
                  <circle cx={end.x} cy={end.y} r={1.6} fill="#e63222" stroke="#ffffff" strokeWidth={0.6} />
                )}
              </g>
            )}
          </>
        )}
      </svg>

      {samples.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="label-cap text-grit-dim text-xs">
            {live ? "Acquiring GPS…" : "No route data"}
          </p>
        </div>
      )}

      {live && samples.length >= 2 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-accent-red px-2 py-1">
          <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
          <span className="label-cap text-[9px] text-accent-red">LIVE</span>
        </div>
      )}
    </div>
  );
}
