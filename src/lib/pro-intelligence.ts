// DEADSET Pro Intelligence — 100% deterministic, no AI, $0 per user.
// Everything here is computed from the sets the athlete already logged.
//
// Four flagship features that competitors gate behind expensive subscriptions:
//   1. Volume Optimizer  — weekly sets per muscle vs science-based landmarks (MEV/MAV/MRV)
//   2. Plateau Breaker   — stall detection + a concrete deload prescription
//   3. Strength Trajectory — estimated-1RM trend + a projected milestone date
//   4. Muscle Balance    — push/pull + legs/upper ratios and an injury-risk score
import type { AppState } from "./types";
import { estimate1RM } from "./calc";
import { toMuscleGroup, MUSCLE_GROUPS, type MuscleGroup } from "./recovery";

const DAY_MS = 86_400_000;

/** Round a weight to the nearest loadable plate jump (2.5 kg). */
function roundToPlate(kg: number): number {
  return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

// ————————————————————————————————————————————————————————
// Shared: working sets per muscle over a trailing window
// ————————————————————————————————————————————————————————
function volumeByMuscle(state: AppState, windowDays: number, now: number): Map<MuscleGroup, number> {
  const since = now - windowDays * DAY_MS;
  const counts = new Map<MuscleGroup, number>();
  for (const s of state.sessions ?? []) {
    const at = new Date(s.startedAt).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    for (const ex of s.exercises) {
      // Warm-ups don't drive growth — count only real working sets.
      const working = ex.sets.filter((set) => set.kind !== "warmup" && set.weight > 0).length;
      if (!working) continue;
      const groups = new Set<MuscleGroup>();
      for (const raw of ex.primary_muscles ?? []) {
        const g = toMuscleGroup(raw);
        if (g) groups.add(g);
      }
      for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + working);
    }
  }
  return counts;
}

// ————————————————————————————————————————————————————————
// 1. Volume Optimizer (MEV / MAV / MRV)
// ————————————————————————————————————————————————————————
export interface VolumeLandmark {
  /** Minimum Effective Volume — below this, little growth. */
  mev: number;
  /** Maximum Adaptive Volume — the productive sweet spot. */
  mav: number;
  /** Maximum Recoverable Volume — beyond this you accumulate junk fatigue. */
  mrv: number;
}

// Weekly working-set landmarks per muscle group (evidence-based ranges,
// condensed to the app's six groups).
export const VOLUME_LANDMARKS: Record<MuscleGroup, VolumeLandmark> = {
  CHEST: { mev: 10, mav: 18, mrv: 22 },
  BACK: { mev: 10, mav: 20, mrv: 25 },
  SHOULDERS: { mev: 8, mav: 18, mrv: 26 },
  ARMS: { mev: 8, mav: 16, mrv: 22 },
  LEGS: { mev: 9, mav: 18, mrv: 22 },
  CORE: { mev: 0, mav: 16, mrv: 25 },
};

export type VolumeZone = "BELOW" | "BUILDING" | "OPTIMAL" | "OVER";

export interface MuscleVolume {
  muscle: MuscleGroup;
  sets: number;
  landmark: VolumeLandmark;
  zone: VolumeZone;
  advice: string;
}

const zoneMeta: Record<VolumeZone, { label: string; color: string }> = {
  BELOW: { label: "Below target", color: "#f59e0b" },
  BUILDING: { label: "Building", color: "#3b9eff" },
  OPTIMAL: { label: "Optimal", color: "#22c55e" },
  OVER: { label: "Overreaching", color: "#e63222" },
};

export function volumeZoneMeta(zone: VolumeZone) {
  return zoneMeta[zone];
}

export function weeklyVolume(state: AppState, now = Date.now()): MuscleVolume[] {
  const counts = volumeByMuscle(state, 7, now);
  return MUSCLE_GROUPS.map((muscle) => {
    const sets = counts.get(muscle) ?? 0;
    const lm = VOLUME_LANDMARKS[muscle];
    let zone: VolumeZone;
    let advice: string;
    if (sets === 0) {
      zone = "BELOW";
      advice = "Not trained this week — add some volume.";
    } else if (sets < lm.mev) {
      zone = "BELOW";
      const need = lm.mev - sets;
      advice = `Add ${need} set${need === 1 ? "" : "s"}/week to reach the growth zone.`;
    } else if (sets < lm.mav) {
      zone = "BUILDING";
      const room = lm.mav - sets;
      advice = `Effective — ${room} more set${room === 1 ? "" : "s"} hits peak growth.`;
    } else if (sets <= lm.mrv) {
      zone = "OPTIMAL";
      advice = "Optimal training volume. Hold here.";
    } else {
      zone = "OVER";
      advice = `${sets - lm.mrv} over recoverable max — pull back next week.`;
    }
    return { muscle, sets, landmark: lm, zone, advice };
  });
}

// ————————————————————————————————————————————————————————
// Shared: estimated-1RM history per lift, oldest → newest
// ————————————————————————————————————————————————————————
export interface LiftPoint {
  date: string;
  e1rm: number;
  weight: number;
  reps: number;
}
export interface LiftSeries {
  exerciseId: string;
  name: string;
  points: LiftPoint[];
}

export function liftSeriesAll(state: AppState, minPoints = 3): LiftSeries[] {
  const byId = new Map<string, { name: string; points: LiftPoint[] }>();
  const sorted = [...(state.sessions ?? [])]
    .filter((s) => s.endedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    for (const ex of s.exercises) {
      let best: LiftPoint | null = null;
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.weight <= 0 || set.reps <= 0) continue;
        // Cap reps for the estimate — Epley is only reliable up to ~12 reps.
        const e = estimate1RM(set.weight, Math.min(set.reps, 12));
        if (!best || e > best.e1rm) best = { date: s.date, e1rm: e, weight: set.weight, reps: set.reps };
      }
      if (!best) continue;
      const entry = byId.get(ex.exerciseId) ?? { name: ex.name, points: [] };
      if (ex.name) entry.name = ex.name;
      entry.points.push(best);
      byId.set(ex.exerciseId, entry);
    }
  }
  const out: LiftSeries[] = [];
  for (const [exerciseId, v] of byId) {
    if (v.points.length >= minPoints) out.push({ exerciseId, name: v.name, points: v.points });
  }
  return out;
}

// ————————————————————————————————————————————————————————
// 2. Plateau Breaker
// ————————————————————————————————————————————————————————
export interface Plateau {
  exerciseId: string;
  name: string;
  peakE1rm: number;
  currentE1rm: number;
  stalledSessions: number;
  deloadWeight: number;
  prescription: string;
}

export function plateaus(state: AppState, stallWindow = 3): Plateau[] {
  const out: Plateau[] = [];
  for (const series of liftSeriesAll(state, stallWindow + 1)) {
    const pts = series.points;
    const recent = pts.slice(-stallWindow);
    const prior = pts.slice(0, -stallWindow);
    if (!prior.length) continue;
    const priorPeak = Math.max(...prior.map((p) => p.e1rm));
    const recentPeak = Math.max(...recent.map((p) => p.e1rm));
    if (recentPeak > priorPeak) continue; // still progressing — not stalled

    const last = pts[pts.length - 1];
    const deload = roundToPlate(last.weight * 0.9);
    out.push({
      exerciseId: series.exerciseId,
      name: series.name,
      peakE1rm: priorPeak,
      currentE1rm: recentPeak,
      stalledSessions: stallWindow,
      deloadWeight: deload,
      prescription: `Deload to ${deload}kg next session, then climb back — aim to beat your ${priorPeak}kg e1RM within 3 weeks. If it stalls again, drop to a 6–8 rep range.`,
    });
  }
  return out.sort((a, b) => b.currentE1rm - a.currentE1rm);
}

// ————————————————————————————————————————————————————————
// 3. Strength Trajectory + projections
// ————————————————————————————————————————————————————————
function linreg(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

export type Trend = "up" | "flat" | "down";
export interface Trajectory {
  exerciseId: string;
  name: string;
  currentE1rm: number;
  perWeek: number;
  trend: Trend;
  nextMilestone: number | null;
  etaDays: number | null;
  etaDate: string | null;
}

export function trajectories(state: AppState, now = Date.now()): Trajectory[] {
  const out: Trajectory[] = [];
  for (const series of liftSeriesAll(state, 3)) {
    const pts = series.points;
    const t0 = new Date(pts[0].date).getTime();
    const xy = pts.map((p) => ({ x: (new Date(p.date).getTime() - t0) / DAY_MS, y: p.e1rm }));
    const { slope } = linreg(xy); // kg per day
    const perWeek = Math.round(slope * 7 * 10) / 10;
    const currentE1rm = pts[pts.length - 1].e1rm;
    const trend: Trend = perWeek > 0.25 ? "up" : perWeek < -0.25 ? "down" : "flat";

    let nextMilestone: number | null = null;
    let etaDays: number | null = null;
    let etaDate: string | null = null;
    if (trend === "up" && slope > 0) {
      nextMilestone = Math.floor(currentE1rm / 5) * 5 + 5; // next 5 kg mark
      const gap = nextMilestone - currentE1rm;
      const days = Math.ceil(gap / slope);
      if (days > 0 && days <= 400) {
        etaDays = days;
        etaDate = new Date(now + days * DAY_MS).toISOString();
      }
    }
    out.push({ exerciseId: series.exerciseId, name: series.name, currentE1rm, perWeek, trend, nextMilestone, etaDays, etaDate });
  }
  return out.sort((a, b) => b.currentE1rm - a.currentE1rm);
}

// ————————————————————————————————————————————————————————
// 4. Muscle Balance + injury-risk score
// ————————————————————————————————————————————————————————
export interface BalanceRatio {
  key: string;
  label: string;
  ratio: number; // a / b
  ideal: [number, number];
  status: "balanced" | "warn";
  advice: string;
}
export interface MuscleBalance {
  score: number; // 0–100, higher = more balanced
  hasData: boolean;
  ratios: BalanceRatio[];
}

export function muscleBalance(state: AppState, now = Date.now()): MuscleBalance {
  const v = volumeByMuscle(state, 28, now);
  const get = (m: MuscleGroup) => v.get(m) ?? 0;
  const push = get("CHEST") + get("SHOULDERS");
  const pull = get("BACK");
  const legs = get("LEGS");
  const upper = get("CHEST") + get("BACK") + get("SHOULDERS") + get("ARMS");
  const total = push + pull + legs + get("ARMS") + get("CORE");

  const ratios: BalanceRatio[] = [];
  const build = (
    key: string,
    label: string,
    a: number,
    b: number,
    ideal: [number, number],
    lowAdvice: string,
    highAdvice: string,
  ): BalanceRatio => {
    const ratio = b > 0 ? a / b : a > 0 ? 99 : 1;
    const status: "balanced" | "warn" = ratio >= ideal[0] && ratio <= ideal[1] ? "balanced" : "warn";
    const advice = status === "balanced" ? "Well balanced." : ratio < ideal[0] ? lowAdvice : highAdvice;
    return { key, label, ratio: Math.round(ratio * 100) / 100, ideal, status, advice };
  };

  ratios.push(
    build(
      "pushpull",
      "Push : Pull",
      push,
      pull,
      [0.7, 1.4],
      "Pulling lags your pushing — add rows/pulldowns to protect your shoulders.",
      "Lots of pressing vs pulling — add back volume to balance the shoulder joint.",
    ),
  );
  ratios.push(
    build(
      "legsupper",
      "Legs : Upper",
      legs,
      upper,
      [0.4, 1.3],
      "Legs are undertrained vs upper body — add a lower day.",
      "Heavy lower-body bias — make sure upper volume keeps pace.",
    ),
  );

  // Injury-risk-ish score: start at 100, penalise each ratio by how far it sits
  // outside its ideal band (as a fraction of the band centre).
  let score = 100;
  for (const r of ratios) {
    if (r.status === "balanced") continue;
    const centre = (r.ideal[0] + r.ideal[1]) / 2;
    const dist = r.ratio < r.ideal[0] ? r.ideal[0] - r.ratio : r.ratio - r.ideal[1];
    score -= Math.min(40, Math.round((dist / centre) * 60));
  }

  return { score: Math.max(0, score), hasData: total >= 6, ratios };
}

// ————————————————————————————————————————————————————————
// Headline insights — the single most useful things to surface in-flow
// (e.g. on the Train screen). Ordered by urgency.
// ————————————————————————————————————————————————————————
export type InsightTone = "warn" | "info" | "good";
export interface Insight {
  tone: InsightTone;
  title: string;
  message: string;
}

const MUSCLE_NAME: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  ARMS: "Arms",
  LEGS: "Legs",
  CORE: "Core",
};

export function allInsights(state: AppState, now = Date.now()): Insight[] {
  const out: Insight[] = [];

  // 1. Overreaching muscles — highest urgency (recovery risk).
  for (const v of weeklyVolume(state, now)) {
    if (v.zone === "OVER") {
      out.push({
        tone: "warn",
        title: `${MUSCLE_NAME[v.muscle]} is overreaching`,
        message: `${v.sets} sets this week — past your recoverable max. Pull back next session.`,
      });
    }
  }

  // 2. Plateaus.
  for (const p of plateaus(state)) {
    out.push({
      tone: "warn",
      title: `${p.name} has stalled`,
      message: `Deload to ${p.deloadWeight}kg, then rebuild past ${p.peakE1rm}kg.`,
    });
  }

  // 3. Muscles below their minimum effective volume.
  for (const v of weeklyVolume(state, now)) {
    if (v.zone === "BELOW" && v.sets > 0) {
      const need = v.landmark.mev - v.sets;
      if (need > 0)
        out.push({
          tone: "info",
          title: `${MUSCLE_NAME[v.muscle]} is below target`,
          message: `Add ${need} set${need === 1 ? "" : "s"} this week to hit the growth zone.`,
        });
    }
  }

  // 4. Positive momentum — a lift on track to a milestone.
  for (const t of trajectories(state, now)) {
    if (t.trend === "up" && t.nextMilestone && t.etaDate) {
      const d = new Date(t.etaDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      out.push({
        tone: "good",
        title: `${t.name} is climbing`,
        message: `On track for ${t.nextMilestone}kg around ${d} at +${t.perWeek}kg/week.`,
      });
      break; // one positive note is enough
    }
  }

  return out;
}

export function topInsight(state: AppState, now = Date.now()): Insight | null {
  return allInsights(state, now)[0] ?? null;
}
