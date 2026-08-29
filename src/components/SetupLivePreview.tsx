import { Check, CircleDashed, Dumbbell, Zap } from "lucide-react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { deriveLiveSetupBlueprint, type SetupMode } from "@/lib/setup-blueprint";
import type { FocusMuscle, Profile, Schedule } from "@/lib/types";

interface SetupLivePreviewProps {
  draft: Partial<Profile>;
  mode: SetupMode | null;
  schedule?: Schedule | null;
  compact?: boolean;
}

const COVERED = "#666a72";
const PRIORITY = "#e63222";

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * A real-time read-back of the setup draft. Nothing shown here is invented
 * history: day placement and muscle coverage come from the same schedule that
 * will be saved, while unanswered inputs remain visibly provisional.
 */
export function SetupLivePreview({
  draft,
  mode,
  schedule = null,
  compact = false,
}: SetupLivePreviewProps) {
  if (!mode) return null;
  const blueprint = deriveLiveSetupBlueprint(draft, { mode, schedule });
  const colors: Partial<Record<FocusMuscle, string>> = {};
  blueprint.coveredMuscles.forEach((muscle) => {
    colors[muscle] = blueprint.priorityMuscles.includes(muscle) ? PRIORITY : COVERED;
  });
  const statusColor =
    blueprint.firstWorkout.status === "READY"
      ? "#22c55e"
      : blueprint.firstWorkout.status === "SET_WEIGHTS"
        ? "#f59e0b"
        : "#e63222";
  const signature = [
    blueprint.splitName,
    blueprint.sessionMinutes,
    blueprint.coveredMuscles.join("-"),
    blueprint.firstWorkout.status,
  ].join(":");

  return (
    <section
      className={`deadset-live-blueprint relative overflow-hidden border border-white/10 bg-[#111214] ${
        compact ? "rounded-2xl px-3 py-2.5" : "rounded-3xl p-4"
      }`}
      aria-label="Live setup blueprint"
      aria-live="polite"
    >
      <div className="deadset-live-scan" aria-hidden="true" />
      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-accent-red" fill="currentColor" />
            <p className="label-cap text-[8px] text-accent-red">LIVE BLUEPRINT</p>
            {blueprint.isProvisional && (
              <span className="label-cap rounded-full border border-white/10 px-1.5 py-0.5 text-[7px] text-grit-dim">
                BUILDING
              </span>
            )}
          </div>
          <div key={signature} className="animate-metric-in">
            <p className="display mt-1 truncate text-lg font-black uppercase leading-none text-white">
              {blueprint.splitName}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-grit-dim">
              {blueprint.sessionMinutes} min · {blueprint.exercisesPerSession} movements
            </p>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1" aria-label={blueprint.splitDetail}>
            {blueprint.week.map((day) => (
              <div key={day.dayKey} className="text-center">
                <span className="block text-[7px] font-black text-grit-dim">
                  {day.dayKey.charAt(0)}
                </span>
                <span
                  className={`mx-auto mt-1 block h-1.5 rounded-full transition-[width,background-color] duration-500 ease-out ${
                    day.isTraining ? "w-full bg-accent-red" : "w-1.5 bg-white/10"
                  }`}
                  title={`${day.dayLabel}: ${day.shortLabel}`}
                />
              </div>
            ))}
          </div>

          {!compact && (
            <div className="mt-3 flex items-start gap-2 border-t border-white/10 pt-2.5">
              {blueprint.firstWorkout.ready ? (
                <Check size={13} className="mt-0.5 shrink-0" style={{ color: statusColor }} />
              ) : blueprint.firstWorkout.status === "SET_WEIGHTS" ? (
                <Dumbbell size={13} className="mt-0.5 shrink-0" style={{ color: statusColor }} />
              ) : (
                <CircleDashed
                  size={13}
                  className="mt-0.5 shrink-0"
                  style={{ color: statusColor }}
                />
              )}
              <p className="text-[9px] leading-relaxed text-grit-dim">
                {blueprint.firstWorkout.message}
              </p>
            </div>
          )}
        </div>

        <div className="w-[92px] shrink-0">
          <MuscleDiagram gradeColors={colors} size={compact ? 76 : 94} view="both" />
          <p className="mt-0.5 text-center text-[7px] font-black uppercase tracking-wider text-grit-dim">
            {blueprint.coveredMuscles.length}/6 covered
          </p>
        </div>
      </div>

      {!compact && blueprint.missingMuscles.length > 0 && (
        <p className="relative mt-2 truncate text-[8px] text-grit-dim">
          <span className="font-black uppercase tracking-wider">Grey:</span>{" "}
          {blueprint.missingMuscles.map(titleCase).join(", ")} — no exercise set
        </p>
      )}
    </section>
  );
}
