import { useMemo } from "react";

import { MUSCLE_SHAPES, bodySilhouette } from "@/lib/body-shapes";
import { TIER_COLOR, type MuscleGrade, type StrengthTier } from "@/lib/strength-grades";
import type { MuscleGroup } from "@/lib/types";

/**
 * The body, coloured by how strong each muscle group is.
 *
 * A list of grades tells you the numbers; this tells you the shape of you —
 * which is the thing people actually screenshot and send to a friend. Front
 * and back, because half the muscles anyone trains are not visible from the
 * front and a map that ignores them reads as half an answer.
 *
 * The anatomy is shared with `MuscleDiagram`, so the body you see on an
 * exercise card and the body you see here are literally the same drawing.
 */

/** Which anatomical regions belong to each graded muscle group. */
const GROUP_REGIONS: Record<MuscleGroup, string[]> = {
  CHEST: ["chest", "upper-chest"],
  BACK: ["lats", "back", "mid-back", "upper-back", "traps", "rotator-cuff"],
  LEGS: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  SHOULDERS: ["front-delts", "side-delts", "rear-delts", "shoulders"],
  ARMS: ["biceps", "triceps", "forearms", "brachialis"],
  CORE: ["core", "obliques"],
  // Not graded as their own group — present so the record is total.
  PUSH: [],
  PULL: [],
  UPPER: [],
  LOWER: [],
  "FULL BODY": [],
  REST: [],
};

/** Muscle group with no history yet: visible, but clearly not a grade. */
const UNGRADED = "#1e1e1e";
const OUTLINE = "#2a2a2a";
const BODY = "#141414";

export function StrengthBodyMap({
  muscles,
  size = 200,
  label,
}: {
  muscles: MuscleGrade[];
  size?: number;
  /** Optional caption under the body, e.g. "Start" or "Now". */
  label?: string;
}) {
  // One lookup from region key to colour, built once per render rather than
  // searched for each of the ~30 paths.
  const regionColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const muscle of muscles) {
      const color = TIER_COLOR[muscle.tier];
      for (const region of GROUP_REGIONS[muscle.muscle] ?? []) map.set(region, color);
    }
    return map;
  }, [muscles]);

  const renderSide = (side: "f" | "b") =>
    Object.entries(MUSCLE_SHAPES).flatMap(([region, shape]) =>
      (shape[side] ?? []).map((d, index) => (
        <path
          key={`${side}-${region}-${index}`}
          d={d}
          fill={regionColor.get(region) ?? UNGRADED}
          stroke={OUTLINE}
          strokeWidth={0.5}
        />
      )),
    );

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex justify-center gap-2">
        {(["f", "b"] as const).map((side) => (
          <svg
            key={side}
            viewBox="0 0 200 420"
            width={size / 2.2}
            height={size}
            role="img"
            aria-label={
              side === "f" ? "Front view, coloured by strength" : "Back view, coloured by strength"
            }
          >
            <path d={bodySilhouette()} fill={BODY} stroke={OUTLINE} strokeWidth={1.2} />
            {renderSide(side)}
          </svg>
        ))}
      </div>
      {label && <span className="label-cap text-[9px] text-grit-dim">{label}</span>}
    </div>
  );
}

/** The ladder, so the colours on the body mean something. */
export function TierLegend({ tiers }: { tiers: StrengthTier[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {tiers.map((tier) => (
        <span
          key={tier}
          className="label-cap rounded-full px-2 py-0.5 text-[8px] font-black"
          style={{ background: TIER_COLOR[tier], color: "#0a0a0a" }}
        >
          {tier}
        </span>
      ))}
    </div>
  );
}
