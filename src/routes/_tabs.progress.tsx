import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Camera, Trophy, Flame, Trash2, Lock } from "lucide-react";

import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { isoDay, calculateStreak } from "@/lib/calc";
import { QuickLogFAB } from "@/components/QuickLogFAB";
import { PRList } from "@/components/PRList";
import { groupForMuscle } from "@/lib/pr-groups";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { askConfirm } from "@/lib/confirm";
import { PR_CATALOG, getPRValue } from "@/lib/fifa-stats";
import { strengthStandard, repMaxTable, TIER_COLORS } from "@/lib/strength-standards";

export const Route = createFileRoute("/_tabs/progress")({
  head: () => ({ meta: [{ title: "DEADSET — Progress" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const [state, set] = useAppState();
  const { isPro, loading } = usePro();
  const analyticsLocked = !loading && !isPro;
  const photoRef = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [arms, setArms] = useState("");
  const [legs, setLegs] = useState("");

  const streak = calculateStreak(state.completedDates);
  const totalSessions = state.sessions.filter((s) => s.endedAt).length;
  const totalVolume = state.sessions.reduce((a, s) => a + (s.totalVolume || 0), 0);
  const totalPRs = state.sessions.reduce((a, s) => a + (s.prCount || 0), 0);

  function addPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      set((s) => ({
        ...s,
        checkIns: [...s.checkIns, { date: new Date().toISOString(), photoDataUrl: url }],
      }));
    };
    r.readAsDataURL(file);
  }

  function togglePhoto(id: string) {
    if (analyticsLocked) {
      openPaywall("photos");
      return;
    }
    setCompare((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length < 2 ? [...c, id] : [c[1], id],
    );
  }

  /** Bodyweight entry nearest to an ISO date (for photo comparisons). */
  function weightNear(date: string): number | null {
    if (state.weights.length === 0) return null;
    const target = new Date(date).getTime();
    let best: { diff: number; weight: number } | null = null;
    for (const w of state.weights) {
      const diff = Math.abs(new Date(w.date).getTime() - target);
      if (!best || diff < best.diff) best = { diff, weight: w.weight };
    }
    return best ? best.weight : null;
  }
  function logWeight() {
    const w = Number(weight);
    if (!w) return;
    set((s) => ({ ...s, weights: [...s.weights, { date: isoDay(), weight: w }] }));
    setWeight("");
  }
  function logMeasurements() {
    set((s) => ({
      ...s,
      measurements: [
        ...s.measurements,
        {
          date: isoDay(),
          chest: +chest || 0,
          waist: +waist || 0,
          arms: +arms || 0,
          legs: +legs || 0,
        },
      ],
    }));
    setChest("");
    setWaist("");
    setArms("");
    setLegs("");
  }
  function deleteWeight(date: string) {
    set((s) => ({ ...s, weights: s.weights.filter((w) => w.date !== date) }));
  }
  function deleteMeasurement(date: string) {
    set((s) => ({ ...s, measurements: s.measurements.filter((m) => m.date !== date) }));
  }
  async function deleteCheckIn(date: string) {
    const ok = await askConfirm({ title: "Delete this photo?", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    set((s) => ({ ...s, checkIns: s.checkIns.filter((c) => c.date !== date) }));
    setCompare((c) => c.filter((d) => d !== date));
  }

  // PRs across both new sessions and legacy logs — enriched with reps, date, history, group
  const prs = useMemo(() => {
    type Acc = {
      exerciseId: string;
      name: string;
      weight: number;
      reps: number;
      date: string;
      muscleGroup?: string;
      history: { date: string; weight: number }[];
    };
    const byId = new Map<string, Acc>();
    const pushHist = (acc: Acc, day: string, w: number) => {
      const existing = acc.history.find((h) => h.date === day);
      if (existing) existing.weight = Math.max(existing.weight, w);
      else acc.history.push({ date: day, weight: w });
    };
    state.logs.forEach((l) => {
      const ex = getExercise(l.exerciseId);
      const name = ex?.name ?? l.exerciseId;
      const day = l.date.slice(0, 10);
      let acc = byId.get(l.exerciseId);
      if (!acc) {
        acc = {
          exerciseId: l.exerciseId,
          name,
          weight: 0,
          reps: 0,
          date: l.date,
          muscleGroup: ex?.muscleGroup,
          history: [],
        };
        byId.set(l.exerciseId, acc);
      }
      pushHist(acc, day, l.weight);
      if (l.weight > acc.weight) {
        acc.weight = l.weight;
        acc.reps = l.reps;
        acc.date = l.date;
      }
    });
    state.sessions.forEach((s) =>
      s.exercises.forEach((e) =>
        e.sets.forEach((set) => {
          const ex = getExercise(e.exerciseId);
          let acc = byId.get(e.exerciseId);
          if (!acc) {
            acc = {
              exerciseId: e.exerciseId,
              name: e.name,
              weight: 0,
              reps: 0,
              date: s.startedAt,
              muscleGroup: ex?.muscleGroup,
              history: [],
            };
            byId.set(e.exerciseId, acc);
          }
          pushHist(acc, s.date, set.weight);
          if (set.weight > acc.weight) {
            acc.weight = set.weight;
            acc.reps = set.reps;
            acc.date = s.startedAt;
          }
        }),
      ),
    );
    return Array.from(byId.values())
      .filter((p) => p.weight > 0)
      .map((p) => ({
        exerciseId: p.exerciseId,
        name: p.name,
        weight: p.weight,
        reps: p.reps,
        date: p.date,
        group: groupForMuscle(p.muscleGroup, p.exerciseId),
        history: p.history.sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [state.logs, state.sessions]);

  // Body part volume split (last 30 days from sessions)
  const bodyParts = useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    state.sessions.forEach((s) => {
      if (new Date(s.startedAt).getTime() < cutoff) return;
      s.exercises.forEach((e) => {
        const vol = e.sets.reduce((a, x) => a + x.weight * x.reps, 0);
        const parts = e.primary_muscles?.length ? e.primary_muscles : ["OTHER"];
        parts.forEach((p) => {
          map[p.toUpperCase()] = (map[p.toUpperCase()] || 0) + vol / parts.length;
        });
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [state.sessions]);

  // Strength curves: top 3 exercises by frequency
  const strengthCurves = useMemo(() => {
    const map = new Map<string, { name: string; points: { date: string; weight: number }[] }>();
    [...state.logs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((l) => {
        const ex = getExercise(l.exerciseId);
        const name = ex?.name ?? l.exerciseId;
        if (!map.has(l.exerciseId)) map.set(l.exerciseId, { name, points: [] });
        const e = map.get(l.exerciseId)!;
        const day = l.date.slice(0, 10);
        const existing = e.points.find((p) => p.date === day);
        if (existing) existing.weight = Math.max(existing.weight, l.weight);
        else e.points.push({ date: day, weight: l.weight });
      });
    state.sessions.forEach((s) =>
      s.exercises.forEach((e) =>
        e.sets.forEach((set) => {
          const key = e.exerciseId;
          if (!map.has(key)) map.set(key, { name: e.name, points: [] });
          const entry = map.get(key)!;
          const day = s.date;
          const existing = entry.points.find((p) => p.date === day);
          if (existing) existing.weight = Math.max(existing.weight, set.weight);
          else entry.points.push({ date: day, weight: set.weight });
        }),
      ),
    );
    return Array.from(map.values())
      .filter((e) => e.points.length >= 2)
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 3);
  }, [state.logs, state.sessions]);

  // Weekly tonnage: last 8 ISO weeks from sessions, legacy logs as per-week fallback
  const weeklyTonnage = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(monday);
      start.setDate(monday.getDate() - (7 - i) * 7);
      return {
        startMs: start.getTime(),
        endMs: start.getTime() + 7 * 24 * 3600 * 1000,
        label: `${start.getDate()}/${start.getMonth() + 1}`,
        isCurrent: i === 7,
        sessionVol: 0,
        logVol: 0,
      };
    });
    const bucket = (iso: string) => {
      const t = new Date(iso).getTime();
      return weeks.find((w) => t >= w.startMs && t < w.endMs);
    };
    state.sessions.forEach((s) => {
      const wk = bucket(s.startedAt);
      if (!wk) return;
      wk.sessionVol += s.exercises.reduce(
        (a, e) => a + e.sets.reduce((b, x) => b + x.weight * x.reps, 0),
        0,
      );
    });
    state.logs.forEach((l) => {
      const wk = bucket(l.date);
      if (wk) wk.logVol += l.weight * l.reps;
    });
    return weeks.map((w) => ({
      label: w.label,
      isCurrent: w.isCurrent,
      volume: w.sessionVol > 0 ? w.sessionVol : w.logVol,
    }));
  }, [state.logs, state.sessions]);

  // Big-three strength standards + rep-max estimates (Pro analytics).
  const bigThree = useMemo(() => {
    const bw = state.profile?.weightKg ?? 0;
    return PR_CATALOG.map((def) => {
      const oneRm = getPRValue(state, def);
      return {
        id: def.id,
        label: def.label,
        oneRm,
        standard: bw > 0 ? strengthStandard(oneRm, bw, def.id as "bench-press" | "squat" | "deadlift", state.profile?.gender) : null,
      };
    });
  }, [state]);

  return (
    <div
      style={{ background: "#0A0A0A", minHeight: "100vh" }}
      className="deadset-page animate-fade-in"
    >
      <header className="px-5 pt-6 pb-4 animate-slide-down">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#E10600" }}>
          DEADSET
        </p>
        <h1 className="display text-3xl font-extrabold uppercase text-white">Track The Work</h1>
      </header>

      {/* Hero stats */}
      <section className="px-5 mb-6 grid grid-cols-2 gap-3 animate-slide-up delay-50">
        <Stat
          label="STREAK"
          value={`${streak}`}
          sub="DAYS"
          accent={streak > 0}
          icon={<Flame size={14} />}
        />
        <Stat label="SESSIONS" value={`${totalSessions}`} sub="LOGGED" />
        <Stat label="VOLUME" value={`${Math.round(totalVolume).toLocaleString()}`} sub="KG" />
        <Stat label="PRS" value={`${totalPRs}`} sub="HIT" accent={totalPRs > 0} />
      </section>

      {/* Calendar streak */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Last 12 Weeks</p>
        <div className="rounded-2xl p-4 overflow-x-auto">
          <StreakCalendar completedDates={state.completedDates} />
        </div>
      </section>

      {/* Advanced Analytics (Pro) */}
      <section className="px-5 mb-6">
        <div className="deadset-section-title">
          <div className="flex items-center gap-2">
            <h2 className="display text-xl font-extrabold uppercase text-grit leading-none">
              Advanced Analytics
            </h2>
            <span className="label-cap text-accent-red border border-accent-red/40 rounded px-1.5">
              Pro
            </span>
          </div>
        </div>
        <div className="relative">
          <div
            className={
              analyticsLocked ? "pointer-events-none select-none blur-[6px] opacity-60" : undefined
            }
          >
            {/* Training Consistency Heatmap */}
            <div className="mb-6">
              <p className="label-cap mb-2">Training Consistency</p>
              <div className="rounded-2xl p-4 overflow-x-auto">
                <ConsistencyHeatmap completedDates={state.completedDates} />
              </div>
            </div>

            {/* Weekly Tonnage */}
            <div className="mb-6">
              <p className="label-cap mb-2">Weekly Tonnage (8 Weeks)</p>
              <div className="rounded-2xl p-4 flex flex-col gap-2">
                {(() => {
                  const max = Math.max(...weeklyTonnage.map((w) => w.volume), 1);
                  return weeklyTonnage.map((wk) => (
                    <div key={wk.label}>
                      <div className="flex justify-between text-xs uppercase font-bold tracking-wider mb-1">
                        <span className={wk.isCurrent ? "text-accent-red" : "text-white"}>
                          {wk.label}
                        </span>
                        <span className="text-[#8A8A8A]">
                          {Math.round(wk.volume).toLocaleString()}kg
                        </span>
                      </div>
                      <div className="h-2 bg-[#0a0a0a]">
                        <div
                          className="h-full"
                          style={{
                            width: `${(wk.volume / max) * 100}%`,
                            background: wk.isCurrent ? "#E10600" : "#7a1410",
                          }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Strength Standards + Rep Maxes */}
            {bigThree.some((b) => b.oneRm > 0) && (
              <div className="mb-6">
                <p className="label-cap mb-2">Strength Standards</p>
                <div className="flex flex-col gap-3">
                  {bigThree
                    .filter((b) => b.oneRm > 0 && b.standard)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl p-4"
                        style={{ background: "#141414", border: "1.5px solid #262626" }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="display text-sm uppercase font-extrabold text-white truncate">
                            {b.label}
                          </p>
                          <span
                            className="label-cap text-[9px] rounded px-1.5 border"
                            style={{
                              color: TIER_COLORS[b.standard!.tier],
                              borderColor: `${TIER_COLORS[b.standard!.tier]}66`,
                            }}
                          >
                            {b.standard!.tier}
                          </span>
                        </div>
                        <p className="text-[11px] text-grit-dim mt-1">
                          e1RM {b.oneRm}kg · {b.standard!.ratio}× bodyweight
                          {b.standard!.nextTier && b.standard!.nextAtKg && (
                            <span>
                              {" "}
                              · {b.standard!.nextAtKg}kg for {b.standard!.nextTier}
                            </span>
                          )}
                        </p>
                        <div className="h-1.5 bg-[#0a0a0a] rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round(b.standard!.progress * 100)}%`,
                              background: TIER_COLORS[b.standard!.tier],
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 mt-3">
                          {repMaxTable(b.oneRm).map((rm) => (
                            <div key={rm.reps} className="text-center border border-grit rounded-lg py-1.5">
                              <p className="label-cap text-[8px] text-grit-dim">{rm.reps}RM</p>
                              <p className="display text-xs font-extrabold text-grit">{rm.weightKg}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Strength Curves */}
            {strengthCurves.length > 0 && (
              <div className="mb-6">
                <p className="label-cap mb-2">Strength Curves</p>
                <div className="flex flex-col gap-3">
                  {strengthCurves.map((c) => (
                    <div
                      key={c.name}
                      className="rounded-2xl p-4"
                      style={{ background: "#141414", border: "1.5px solid #262626" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="display text-sm uppercase font-extrabold text-white truncate">
                          {c.name}
                        </p>
                        <p className="display text-lg font-extrabold text-[#E10600]">
                          {Math.max(...c.points.map((p) => p.weight))}KG
                        </p>
                      </div>
                      <LineChart points={c.points.map((p) => p.weight)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body Part Split */}
            {bodyParts.length > 0 && (
              <div>
                <p className="label-cap mb-2">Body Part Volume (30d)</p>
                <div className="rounded-2xl p-4 flex flex-col gap-2">
                  {(() => {
                    const max = Math.max(...bodyParts.map((b) => b[1]));
                    return bodyParts.map(([name, vol]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs uppercase font-bold tracking-wider mb-1">
                          <span className="text-white">{name}</span>
                          <span className="text-[#8A8A8A]">
                            {Math.round(vol).toLocaleString()}kg
                          </span>
                        </div>
                        <div className="h-2 bg-[#0a0a0a]">
                          <div
                            className="h-full bg-[#E10600]"
                            style={{ width: `${(vol / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
          {analyticsLocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-grit-card border p-4 max-w-[260px] text-center">
                <Lock size={20} className="text-accent-red mx-auto mb-2" />
                <p className="label-cap mb-1">Advanced Analytics</p>
                <p className="text-xs text-grit-dim mb-3">
                  Volume balance, tonnage, curves and heatmap.
                </p>
                <button
                  onClick={() => openPaywall("advanced-analytics")}
                  className="btn-grit px-4 py-2 text-xs"
                >
                  Unlock With Pro
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Weight */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Weight Log</p>
        <div
          className="rounded-2xl p-4"
          style={{ background: "#141414", border: "1.5px solid #262626" }}
        >
          <div className="flex gap-2 mb-3">
            <input
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Today's kg"
              className="input-grit"
            />
            <button onClick={logWeight} className="btn-grit">
              Log
            </button>
          </div>
          <WeightChart entries={state.weights} />
          {state.weights.length > 0 && (
            <div className="mt-3 border-t border-grit pt-3 max-h-40 overflow-y-auto">
              <p className="label-cap text-[10px] mb-1">History</p>
              {state.weights
                .slice()
                .reverse()
                .map((w) => (
                  <div key={w.date} className="flex items-center justify-between py-1 text-xs">
                    <span className="text-[#8A8A8A]">{w.date}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-grit">{w.weight} kg</span>
                      <button
                        onClick={() => deleteWeight(w.date)}
                        className="text-[#8A8A8A] hover:text-[#E10600]"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Measurements */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Measurements (cm)</p>
        <div className="rounded-2xl p-4 grid grid-cols-2 gap-3">
          <Input label="Chest" v={chest} set={setChest} />
          <Input label="Waist" v={waist} set={setWaist} />
          <Input label="Arms" v={arms} set={setArms} />
          <Input label="Legs" v={legs} set={setLegs} />
          <button onClick={logMeasurements} className="btn-grit col-span-2">
            Save
          </button>
          {state.measurements.length >= 2 && (
            <div className="col-span-2 mt-2">
              <MeasurementsChart entries={state.measurements} />
              <div className="flex gap-3 justify-center mt-2 text-[10px] label-cap">
                <span className="flex items-center gap-1">
                  <i className="w-2 h-2 inline-block" style={{ background: "#E10600" }} />
                  Chest
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2 h-2 inline-block" style={{ background: "#f5f5f0" }} />
                  Waist
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2 h-2 inline-block" style={{ background: "#7acc7a" }} />
                  Arms
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2 h-2 inline-block" style={{ background: "#7aa3cc" }} />
                  Legs
                </span>
              </div>
            </div>
          )}
          {state.measurements.length > 0 && (
            <div className="col-span-2 mt-2 border-t border-grit pt-2 max-h-40 overflow-y-auto">
              <p className="label-cap text-[10px] mb-1">History</p>
              {state.measurements
                .slice()
                .reverse()
                .map((m) => (
                  <div key={m.date} className="flex items-center justify-between py-1 text-[11px]">
                    <span className="text-[#8A8A8A]">{m.date}</span>
                    <span className="text-white">
                      C{m.chest} W{m.waist} A{m.arms} L{m.legs}
                    </span>
                    <button
                      onClick={() => deleteMeasurement(m.date)}
                      className="text-[#8A8A8A] hover:text-[#E10600]"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Check-ins */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Photo Check-ins</p>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addPhoto(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => photoRef.current?.click()} className="btn-ghost w-full">
          <Camera size={16} className="mr-2" /> Weekly Check-in
        </button>
        {compare.length === 2 && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {[...compare]
                .sort((a, b) => a.localeCompare(b))
                .map((d) => {
                  const p = state.checkIns.find((c) => c.date === d);
                  const w = weightNear(d);
                  return (
                    <div key={d} className="rounded-2xl">
                      <img src={p?.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                      <div className="text-[10px] p-1 label-cap text-center">
                        {p?.date.slice(0, 10)}
                        {w !== null && <span className="text-grit-dim"> · {w}kg</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
            {(() => {
              const [a, b] = [...compare].sort((x, y) => x.localeCompare(y));
              const days = Math.abs(
                Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000),
              );
              const wa = weightNear(a);
              const wb = weightNear(b);
              const delta = wa !== null && wb !== null ? Math.round((wb - wa) * 10) / 10 : null;
              return (
                <p className="label-cap text-[10px] text-center mt-2 text-grit-dim">
                  {days >= 14 ? `${Math.round(days / 7)} weeks apart` : `${days} days apart`}
                  {delta !== null && delta !== 0 && (
                    <span style={{ color: delta > 0 ? "#e63222" : "#22c55e" }}>
                      {" "}
                      · {delta > 0 ? "+" : ""}
                      {delta}kg
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
        )}
        {state.checkIns.length > 0 && (
          <>
            <p className="label-cap mt-3 mb-2 text-[10px] flex items-center gap-1.5">
              Tap to compare · long-press × to delete
              {analyticsLocked && (
                <span className="label-cap text-[8px] text-accent-red border border-accent-red/40 rounded px-1">
                  PRO
                </span>
              )}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {state.checkIns
                .slice()
                .reverse()
                .map((c) => {
                  const sel = compare.includes(c.date);
                  return (
                    <div key={c.date} className="relative">
                      <button
                        onClick={() => togglePhoto(c.date)}
                        className="relative border block w-full"
                        style={{ borderColor: sel ? "#E10600" : "#262626" }}
                      >
                        <img
                          src={c.photoDataUrl}
                          alt=""
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <span
                          className="absolute bottom-0 inset-x-0 text-[9px] text-center label-cap py-0.5"
                          style={{ background: "rgba(0,0,0,0.7)" }}
                        >
                          {c.date.slice(5, 10)}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteCheckIn(c.date)}
                        aria-label="Delete photo"
                        className="absolute top-1 right-1 bg-black/80 rounded-2xl text-[#E10600] p-1 hover:bg-[#E10600] hover:text-black"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </section>

      {/* PRs */}
      <section className="px-5 mb-8">
        <p className="label-cap mb-3 flex items-center gap-2">
          <Trophy size={12} /> Personal Records
        </p>
        <PRList prs={prs} />
      </section>

      <QuickLogFAB />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="p-3 rounded-2xl"
      style={{ background: "#141414", border: "1.5px solid #262626" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8A8A] flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className="display text-3xl font-extrabold leading-none mt-1"
        style={{ color: accent ? "#E10600" : "#ffffff" }}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider mt-1">{sub}</p>}
    </div>
  );
}

function ConsistencyHeatmap({ completedDates }: { completedDates: string[] }) {
  // Count workouts per date (some dates may appear multiple times)
  const countMap = new Map<string, number>();
  for (const d of completedDates) {
    countMap.set(d, (countMap.get(d) ?? 0) + 1);
  }

  const WEEKS = 52;
  const today = new Date();
  // Start on Monday 52 weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (WEEKS - 1) * 7);

  // Build weeks array (each week = 7 days)
  const weeks: { date: string; count: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const iso = isoDay(dt);
      col.push({ date: iso, count: countMap.get(iso) ?? 0 });
    }
    weeks.push(col);
  }

  // Month labels: find first week of each month
  const monthLabels: { label: string; weekIdx: number }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const firstDay = weeks[w][0].date;
    const dt = new Date(firstDay);
    // Show label if it's the first occurrence of this month
    if (dt.getDate() <= 7) {
      const prev = w > 0 ? new Date(weeks[w - 1][0].date).getMonth() : -1;
      if (dt.getMonth() !== prev) {
        monthLabels.push({
          label: dt.toLocaleString("default", { month: "short" }).toUpperCase(),
          weekIdx: w,
        });
      }
    }
  }

  const CELL = 10;
  const GAP = 2;
  const totalW = WEEKS * (CELL + GAP) - GAP;

  return (
    <div style={{ minWidth: totalW }}>
      {/* Month labels */}
      <div className="flex mb-1" style={{ gap: GAP }}>
        {weeks.map((_, w) => {
          const label = monthLabels.find((m) => m.weekIdx === w);
          return (
            <div key={w} style={{ width: CELL, flexShrink: 0 }}>
              {label && (
                <span
                  className="text-[8px] label-cap text-[#8A8A8A]"
                  style={{ whiteSpace: "nowrap" }}
                >
                  {label.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Grid */}
      <div className="flex" style={{ gap: GAP }}>
        {weeks.map((col, w) => (
          <div key={w} className="flex flex-col" style={{ gap: GAP }}>
            {col.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.count} workout${cell.count !== 1 ? "s" : ""}`}
                style={{
                  width: CELL,
                  height: CELL,
                  background:
                    cell.count === 0 ? "#0A0A0A" : cell.count === 1 ? "#7a1410" : "#E10600",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] label-cap text-[#8A8A8A]">Less</span>
        {["#0A0A0A", "#7a1410", "#E10600"].map((c) => (
          <div key={c} style={{ width: CELL, height: CELL, background: c, flexShrink: 0 }} />
        ))}
        <span className="text-[9px] label-cap text-[#8A8A8A]">More</span>
      </div>
    </div>
  );
}

function StreakCalendar({ completedDates }: { completedDates: string[] }) {
  const set = new Set(completedDates);
  const weeks = 12;
  const cells: { date: string; done: boolean; isToday: boolean }[][] = [];
  const today = new Date();
  // align to Monday of current week
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; done: boolean; isToday: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const iso = isoDay(dt);
      col.push({ date: iso, done: set.has(iso), isToday: iso === isoDay() });
    }
    cells.push(col);
  }
  return (
    <div className="flex gap-[3px]">
      {cells.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((c) => (
            <div
              key={c.date}
              title={c.date}
              className="w-3 h-3"
              style={{
                background: c.done ? "#E10600" : "#0A0A0A",
                outline: c.isToday ? "1px solid #f5f5f0" : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-xs text-[#8a8a8a]">Not enough data.</p>;
  const w = 320,
    h = 80,
    pad = 6;
  const min = Math.min(...points),
    max = Math.max(...points);
  const range = max - min || 1;
  const pts = points
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (points.length - 1);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#E10600" strokeWidth="2" />
    </svg>
  );
}

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
  if (entries.length < 2)
    return <p className="text-xs text-[#8a8a8a]">Log at least two entries to see your trend.</p>;
  const w = 300,
    h = 100,
    pad = 6;
  const vals = entries.map((e) => e.weight);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const range = max - min || 1;
  const pts = entries
    .map((e, i) => {
      const x = pad + (i * (w - pad * 2)) / (entries.length - 1);
      const y = h - pad - ((e.weight - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <polyline points={pts} fill="none" stroke="#E10600" strokeWidth="2" />
      {entries.map((e, i) => {
        const x = pad + (i * (w - pad * 2)) / (entries.length - 1);
        const y = h - pad - ((e.weight - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#f5f5f0" />;
      })}
    </svg>
  );
}

function Input({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <div>
      <label className="label-cap block mb-1">{label}</label>
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => set(e.target.value)}
        className="input-grit"
      />
    </div>
  );
}

function MeasurementsChart({
  entries,
}: {
  entries: { date: string; chest: number; waist: number; arms: number; legs: number }[];
}) {
  const w = 300,
    h = 110,
    pad = 8;
  const keys: { k: "chest" | "waist" | "arms" | "legs"; color: string }[] = [
    { k: "chest", color: "#E10600" },
    { k: "waist", color: "#ffffff" },
    { k: "arms", color: "#7acc7a" },
    { k: "legs", color: "#7aa3cc" },
  ];
  const all = entries.flatMap((e) => keys.map((k) => e[k.k])).filter((v) => v > 0);
  const min = Math.min(...all),
    max = Math.max(...all);
  const range = max - min || 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
      {keys.map(({ k, color }) => {
        const pts = entries
          .map((e, i) => {
            const x = pad + (i * (w - pad * 2)) / Math.max(1, entries.length - 1);
            const y = h - pad - ((e[k] - min) / range) * (h - pad * 2);
            return `${x},${y}`;
          })
          .join(" ");
        return <polyline key={k} points={pts} fill="none" stroke={color} strokeWidth="1.5" />;
      })}
    </svg>
  );
}
