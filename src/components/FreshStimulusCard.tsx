import { useMemo } from "react";
import { Shuffle } from "lucide-react";

import { staleMuscles } from "@/lib/exercise-variety";
import { allExercises } from "@/lib/exercises";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const MUSCLE_NAME: Record<string, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  ARMS: "Arms",
  LEGS: "Legs",
  CORE: "Core",
};

/**
 * Fresh stimulus — muscles that have been fed the exact same movement for
 * 6+ sessions get a concrete library alternative. A stalled lift often moves
 * again the week its stimulus changes. Silent unless something is stale.
 */
export function FreshStimulusCard({ state }: { state: AppState }) {
  const stale = useMemo(() => {
    const p = state.profile;
    if (!p) return [];
    return staleMuscles(state.sessions, allExercises(state.savedExercises), p.equipment, isoDay());
  }, [state.sessions, state.savedExercises, state.profile]);

  if (!stale.length) return null;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Shuffle size={12} /> Fresh stimulus
        </p>

        <div className="space-y-3 mt-2">
          {stale.map((m) => (
            <div key={m.muscle}>
              <p className="text-xs text-grit leading-relaxed">
                <span className="display font-extrabold uppercase">
                  {MUSCLE_NAME[m.muscle] ?? m.muscle}
                </span>{" "}
                has been all {m.exerciseName} for {m.sessionsCount} sessions.
              </p>
              <p className="text-[11px] text-grit-dim leading-relaxed mt-0.5">
                Try {m.suggestions.map((s) => s.name).join(" or ")} for a few weeks — variation is
                often what un-sticks a stalled lift.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
