import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  Link2,
  Pencil,
  Target,
  Trophy,
} from "lucide-react";
import { useState } from "react";

import { isoDay, todayKey } from "@/lib/calc";
import { getExercise } from "@/lib/exercises";
import { hapticSelection } from "@/lib/haptics";
import type { AppState, DayKey, Program, Schedule } from "@/lib/types";
import { formatWeight, unitOf } from "@/lib/units";

import { RestDayRecovery } from "./RestDayRecovery";
import { SupersetHint } from "./SupersetHint";

const DAY_FULL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

interface BriefRow {
  id: string;
  name: string;
  target: string;
  muscle?: string;
  equipment?: string;
  weightKg?: number;
  restSeconds?: number;
  superset: boolean;
  bestKg: number | null;
}

export function TrainWorkoutBrief({
  state,
  selectedDay,
  schedule,
  activeProgram,
}: {
  state: AppState;
  selectedDay: DayKey;
  schedule: Schedule;
  activeProgram?: Program;
}) {
  const [expanded, setExpanded] = useState(false);
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];
  const unit = unitOf(state);
  const rows: BriefRow[] = activeProgram
    ? (programDay?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        target: `${item.sets} × ${item.reps}`,
        muscle: item.primary_muscles?.[0],
        equipment: item.equipment,
        weightKg: item.weightKg,
        restSeconds: item.restSeconds,
        superset: false,
        bestKg: bestSet(state.logs, item.id),
      }))
    : (day?.exerciseIds ?? []).flatMap((id) => {
        const exercise = getExercise(id, state.savedExercises);
        if (!exercise) return [];
        const config = day?.exerciseConfig?.[id];
        return [
          {
            id,
            name: exercise.name,
            target: `${config?.sets ?? day?.sets ?? exercise.sets} × ${
              config?.reps ?? day?.reps ?? exercise.reps
            }`,
            muscle: exercise.primaryMuscles?.[0] ?? exercise.muscleGroup,
            equipment: exercise.equipmentLabel,
            weightKg: config?.weightKg,
            restSeconds: config?.restSeconds,
            superset: Boolean(config?.supersetWithNext),
            bestKg: bestSet(state.logs, id),
          },
        ];
      });

  const totalSets = rows.reduce((total, row) => {
    const parsed = Number.parseInt(row.target, 10);
    return total + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  const estimatedMinutes = rows.length
    ? Math.max(20, Math.round((8 + totalSets * 2.2) / 5) * 5)
    : 0;
  const focus = Array.from(
    new Set(rows.map((row) => row.muscle?.replaceAll("_", " ").toUpperCase()).filter(Boolean)),
  ).slice(0, 3) as string[];
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  const isLoggedToday = selectedDay === todayKey() && state.completedDates.includes(isoDay());
  const label = (activeProgram ? programDay?.label : day?.label) || "REST";

  return (
    <section className="deadset-section" aria-labelledby="session-brief-title">
      <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] shadow-[0_18px_55px_rgba(0,0,0,.24)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
          <div className="min-w-0">
            <p className="label-cap text-[9px] text-accent-red">Session brief</p>
            <h2
              id="session-brief-title"
              className="display mt-1 truncate text-2xl font-black uppercase leading-none text-grit"
            >
              {selectedDay === todayKey() ? "Today" : DAY_FULL[selectedDay]}
            </h2>
            <p className="mt-1.5 truncate text-[11px] font-semibold text-grit-dim">{label}</p>
          </div>
          <Link
            to="/plan"
            className="btn-ghost tap-44 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px]"
          >
            <Pencil size={13} /> Edit
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="display text-xl font-black uppercase text-grit">Recovery is training</p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-grit-dim">
              No exercises are scheduled. Use the day to recover, or edit your split if you want to
              train.
            </p>
            <RestDayRecovery state={state} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-px border-b border-white/8 bg-white/8">
              <BriefStat icon={Layers3} value={String(rows.length)} label="Movements" />
              <BriefStat icon={Target} value={String(totalSets)} label="Work sets" />
              <BriefStat icon={Clock3} value={`≈${estimatedMinutes}`} label="Minutes" />
            </div>

            {focus.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto border-b border-white/8 px-4 py-2.5">
                <span className="label-cap shrink-0 text-[8px] text-grit-dim">Focus</span>
                {focus.map((muscle) => (
                  <span
                    key={muscle}
                    className="shrink-0 rounded-full border border-accent-red/25 bg-accent-red/8 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-accent-red"
                  >
                    {muscle}
                  </span>
                ))}
              </div>
            )}

            <ol className="divide-y divide-white/[.065] px-4">
              {visibleRows.map((row, index) => (
                <li
                  key={`${row.id}-${index}`}
                  className="flex min-h-[66px] items-center gap-3 py-3"
                >
                  <span className="display grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/30 text-sm font-black text-accent-red">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[13px] font-black text-grit">{row.name}</span>
                      {row.superset && (
                        <Link2
                          size={12}
                          className="shrink-0 text-accent-red"
                          aria-label="Superset with the next movement"
                        />
                      )}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-grit-dim">
                      <span>{row.target}</span>
                      {row.weightKg ? <span>{formatWeight(row.weightKg, unit)}</span> : null}
                      {row.restSeconds ? <span>{row.restSeconds}s rest</span> : null}
                      {row.muscle ? <span className="uppercase">{row.muscle}</span> : null}
                    </span>
                  </span>
                  {row.bestKg ? (
                    <span className="flex shrink-0 flex-col items-end text-right">
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[.14em] text-accent-red">
                        <Trophy size={10} /> Best
                      </span>
                      <span className="mt-0.5 text-[10px] font-bold text-grit">
                        {formatWeight(row.bestKg, unit)}
                      </span>
                    </span>
                  ) : row.equipment ? (
                    <span className="max-w-[4.5rem] shrink-0 truncate text-right text-[9px] font-bold uppercase text-grit-dim">
                      {row.equipment}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            {rows.length > 5 && (
              <button
                type="button"
                onClick={() => {
                  hapticSelection();
                  setExpanded((current) => !current);
                }}
                aria-expanded={expanded}
                className="press flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-white/8 text-[10px] font-black uppercase tracking-[.14em] text-grit-dim"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={14} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Show {rows.length - 5} more
                  </>
                )}
              </button>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] leading-relaxed text-grit-dim">
                Form clips stay one tap away inside the live workout.
              </p>
              {isLoggedToday && (
                <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-emerald-400">
                  Logged
                </span>
              )}
            </div>

            <div className="px-4 pb-4">
              <SupersetHint
                exercises={rows.map((row) => ({ name: row.name, muscle: row.muscle }))}
              />
              {activeProgram && (
                <Link
                  to="/programs/$programId"
                  params={{ programId: activeProgram.id }}
                  className="press mt-2 flex min-h-11 items-center justify-between rounded-xl border border-accent-red/25 bg-accent-red/8 px-3 text-[10px] font-black uppercase tracking-[.12em] text-accent-red"
                >
                  <span className="truncate">{activeProgram.name}</span>
                  <span className="shrink-0">View programme</span>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function BriefStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Layers3;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-h-[68px] flex-col justify-center bg-[#121316] px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-accent-red">
        <Icon size={13} />
        <strong className="display text-xl font-black leading-none text-grit">{value}</strong>
      </span>
      <span className="mt-1 text-[8px] font-black uppercase tracking-[.13em] text-grit-dim">
        {label}
      </span>
    </div>
  );
}

function bestSet(logs: { exerciseId: string; weight: number }[], id: string): number | null {
  const values = logs.filter((log) => log.exerciseId === id).map((log) => log.weight);
  return values.length ? Math.max(...values) : null;
}
