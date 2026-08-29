import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { allExercises } from "@/lib/exercises";
import { hapticSetupComplete } from "@/lib/haptics";
import { getHydrationCount, useAppState } from "@/lib/storage";
import { strengthReport, TIER_BLURB, TIER_COLOR } from "@/lib/strength-grades";
import { detectTierClimbs, mergeSeen, type SeenTiers, type TierClimb } from "@/lib/tier-climbs";

const SEEN_KEY = "deadset_strength_tiers_seen";

function readSeen(): SeenTiers {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SeenTiers) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: SeenTiers) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* Local storage can be unavailable in restricted browser modes. */
  }
}

/**
 * Interrupts once when a muscle climbs a strength tier.
 *
 * The app celebrated streaks, tonnage and badges but not this — and a chest
 * going from Novice to Intermediate takes months, where a tonnage badge takes
 * an afternoon. It was the biggest thing that could happen to somebody using
 * this app and it changed a colour on a screen they might not open for a week.
 *
 * Follows the other watchers: existing grades are recorded silently on first
 * load and after a remote hydration, so only a genuine live climb celebrates.
 * Somebody signing in on a new phone should not be congratulated for history
 * that just finished downloading.
 */
export function StrengthTierWatcher() {
  const [state] = useAppState();
  const [climb, setClimb] = useState<TierClimb | null>(null);
  const initialised = useRef(false);
  const lastHydration = useRef(getHydrationCount());

  const library = useMemo(
    () =>
      allExercises(state.savedExercises).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
      })),
    [state.savedExercises],
  );
  const muscles = useMemo(() => strengthReport(state, library).muscles, [state, library]);
  const gradeKey = muscles.map((grade) => `${grade.muscle}:${grade.tier}`).join(",");

  useEffect(() => {
    if (muscles.length === 0) return;

    const hydration = getHydrationCount();
    const hydrated = hydration !== lastHydration.current;
    lastHydration.current = hydration;
    const first = !initialised.current || hydrated;
    initialised.current = true;

    const seen = readSeen();
    if (!first) {
      const climbs = detectTierClimbs(muscles, seen);
      if (climbs[0]) {
        setClimb(climbs[0]);
        hapticSetupComplete();
      }
    }
    writeSeen(mergeSeen(seen, muscles));
    // gradeKey collapses the grades to what actually matters here; depending on
    // `muscles` would re-run on every unrelated state write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeKey]);

  if (!climb) return null;

  const color = TIER_COLOR[climb.to];
  const muscleName = climb.muscle.toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${climb.muscle} reached ${climb.to.replace("_", " ")}`}
      className="fixed inset-0 z-[140] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "rgba(6,6,7,0.96)" }}
    >
      <button
        onClick={() => setClimb(null)}
        aria-label="Close"
        className="absolute right-5 top-5 p-2 text-grit-dim press"
      >
        <X size={20} />
      </button>

      <p className="label-cap tier-climb-line text-[10px] text-grit-dim">TIER UP</p>

      <div className="tier-climb-figure my-4">
        <MuscleDiagram
          view="front"
          size={210}
          gradeColors={{ [climb.muscle]: color } as Record<string, string>}
        />
      </div>

      <p
        className="label-cap tier-climb-line text-[10px]"
        style={{ color, animationDelay: "80ms" }}
      >
        YOUR {climb.muscle}
      </p>
      <h1
        className="display tier-climb-tier mt-1 text-4xl font-extrabold uppercase leading-none"
        style={{ color }}
      >
        {climb.to.replace("_", " ")}
      </h1>
      <p
        className="tier-climb-line mt-3 max-w-xs text-sm leading-relaxed text-grit-dim"
        style={{ animationDelay: "220ms" }}
      >
        {climb.steps > 1
          ? `Up ${climb.steps} tiers from ${climb.from.replace("_", " ").toLowerCase()}. `
          : `Up from ${climb.from.replace("_", " ").toLowerCase()}. `}
        {TIER_BLURB[climb.to]}
      </p>

      <Link
        to="/strength"
        onClick={() => setClimb(null)}
        className="btn-grit tier-climb-line mt-7 w-full max-w-xs min-h-12"
        style={{ animationDelay: "300ms" }}
      >
        See my {muscleName} graded
      </Link>
      <button
        onClick={() => setClimb(null)}
        className="tier-climb-line mt-3 py-2 label-cap text-[9px] text-grit-dim press"
        style={{ animationDelay: "340ms" }}
      >
        Keep training
      </button>
    </div>
  );
}
