/**
 * Highlights the muscles one movement works: primary in red, secondary dim.
 *
 * The anatomy itself is shared with the strength map (`@/lib/body-shapes`) so
 * the same muscle is always the same shape wherever it is drawn.
 */
import { MUSCLE_SHAPES, bodySilhouette } from "@/lib/body-shapes";

type Muscle = string;

interface Props {
  primary?: Muscle[];
  secondary?: Muscle[];
  size?: number;
}

const ACCENT = "#e63222";
const DIM = "#5a1a14";
const BASE = "#1a1a1a";
const STROKE = "#2a2a2a";

export function MuscleDiagram({ primary = [], secondary = [], size = 220 }: Props) {
  const prim = new Set(primary.map((m) => m.toLowerCase()));
  const sec = new Set(secondary.map((m) => m.toLowerCase()));

  const fill = (key: string) => (prim.has(key) ? ACCENT : sec.has(key) ? DIM : BASE);

  const render = (side: "f" | "b") =>
    Object.entries(MUSCLE_SHAPES).flatMap(([key, def]) =>
      (def[side] ?? []).map((d, i) => (
        <path
          key={`${side}-${key}-${i}`}
          d={d}
          fill={fill(key)}
          stroke={STROKE}
          strokeWidth={0.5}
        />
      )),
    );

  return (
    <div className="flex justify-center gap-4" style={{ width: "100%" }}>
      {(["f", "b"] as const).map((side) => (
        <svg key={side} viewBox="0 0 200 420" width={size / 2.2} height={size} aria-hidden>
          <path d={bodySilhouette()} fill={BASE} stroke={STROKE} strokeWidth={1.2} />
          {render(side)}
        </svg>
      ))}
    </div>
  );
}
