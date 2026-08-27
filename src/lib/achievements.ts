import { calculateStreak } from "./calc";
import { longestStreak } from "./lifetime-stats";
import type { AppState, WorkoutSession } from "./types";

export type AchievementCategory =
  | "CONSISTENCY"
  | "TONNAGE"
  | "STRENGTH"
  | "VARIETY"
  | "DEDICATION"
  | "NUTRITION";

export type AchievementRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export const RARITY_COLOR: Record<AchievementRarity, string> = {
  COMMON: "#8a8a8a",
  RARE: "#60a5fa",
  EPIC: "#a78bfa",
  LEGENDARY: "#e63222",
};

export interface Achievement {
  id: string;
  label: string;
  /** What earns it, phrased as the requirement. */
  desc: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  /** Where the athlete is now, clamped to `target`. */
  progress: number;
  target: number;
  unlocked: boolean;
}

/**
 * Everything the catalog measures against, derived from local state in one
 * pass. Achievements are deliberately computed on-device from data the athlete
 * already has: they cost nothing to run and unlock the instant a set lands,
 * with no server round trip.
 */
export interface AchievementFacts {
  sessions: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  totalPRs: number;
  currentStreak: number;
  longestStreak: number;
  daysTrained: number;
  distinctExercises: number;
  distinctMuscleGroups: number;
  /** Heaviest single working set ever logged. */
  heaviestSetKg: number;
  /** Biggest tonnage in one session. */
  biggestSessionKg: number;
  /** Most sets inside one session. */
  longestSessionSets: number;
  sessionsBefore7am: number;
  sessionsAfter9pm: number;
  weekendSessions: number;
  checkIns: number;
  weighIns: number;
  measurements: number;
  programsBuilt: number;
  daysFoodLogged: number;
  daysProteinHit: number;
  daysWaterHit: number;
  /** Best strength-to-bodyweight ratios, for the classic bodyweight milestones. */
  benchRatio: number;
  squatRatio: number;
  deadliftRatio: number;
}

const MUSCLE_KEYWORDS: { group: string; match: RegExp }[] = [
  { group: "CHEST", match: /bench|chest|fly|dip|push[- ]?up/i },
  { group: "BACK", match: /row|pull|lat|deadlift|chin/i },
  { group: "LEGS", match: /squat|leg|lunge|calf|rdl|hamstring|glute/i },
  { group: "SHOULDERS", match: /shoulder|press|raise|delt|ohp/i },
  { group: "ARMS", match: /curl|tricep|bicep|skull|hammer/i },
  { group: "CORE", match: /plank|crunch|ab |abs|core|leg raise/i },
];

function muscleGroupOf(name: string): string | null {
  for (const { group, match } of MUSCLE_KEYWORDS) {
    if (match.test(name)) return group;
  }
  return null;
}

/** Best working-set weight for any lift whose name matches. */
function bestMatching(sessions: WorkoutSession[], match: RegExp): number {
  let best = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (!match.test(e.name)) continue;
      for (const set of e.sets) {
        // Warm-ups, drop sets and timed efforts are not a lift's true best.
        if (set.kind || set.mode) continue;
        if (set.weight > best) best = set.weight;
      }
    }
  }
  return best;
}

export function achievementFacts(state: AppState): AchievementFacts {
  const done = (state.sessions || []).filter((s) => s.endedAt);
  const exerciseIds = new Set<string>();
  const groups = new Set<string>();

  let totalVolumeKg = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalPRs = 0;
  let heaviestSetKg = 0;
  let biggestSessionKg = 0;
  let longestSessionSets = 0;
  let sessionsBefore7am = 0;
  let sessionsAfter9pm = 0;
  let weekendSessions = 0;

  for (const s of done) {
    totalVolumeKg += s.totalVolume || 0;
    totalPRs += s.prCount || 0;
    if ((s.totalVolume || 0) > biggestSessionKg) biggestSessionKg = s.totalVolume || 0;

    let setsHere = 0;
    for (const e of s.exercises) {
      exerciseIds.add(e.exerciseId);
      const group = muscleGroupOf(e.name);
      if (group) groups.add(group);
      for (const set of e.sets) {
        setsHere += 1;
        totalReps += set.reps || 0;
        // Added load on a hold is not a heaviest-set candidate.
        if (!set.kind && !set.mode && set.weight > heaviestSetKg) heaviestSetKg = set.weight;
      }
    }
    totalSets += setsHere;
    if (setsHere > longestSessionSets) longestSessionSets = setsHere;

    const started = new Date(s.startedAt);
    if (!Number.isNaN(started.getTime())) {
      const hour = started.getHours();
      if (hour < 7) sessionsBefore7am += 1;
      if (hour >= 21) sessionsAfter9pm += 1;
      const day = started.getDay();
      if (day === 0 || day === 6) weekendSessions += 1;
    }
  }

  // Nutrition days, counted as distinct dates that cleared the bar.
  const kcalByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const f of state.foodLog || []) {
    kcalByDay.set(f.date, (kcalByDay.get(f.date) ?? 0) + (f.calories || 0));
    proteinByDay.set(f.date, (proteinByDay.get(f.date) ?? 0) + (f.protein || 0));
  }
  const bodyweight = state.profile?.weightKg ?? 0;
  // 1.6 g/kg is the low end of the accepted hypertrophy range, so it reads as a
  // genuine "hit protein" day rather than a token amount.
  const proteinTarget = bodyweight > 0 ? bodyweight * 1.6 : 120;
  let daysProteinHit = 0;
  for (const grams of proteinByDay.values()) if (grams >= proteinTarget) daysProteinHit += 1;

  const waterByDay = new Map<string, number>();
  for (const w of state.water || []) {
    const day = (w.date || "").slice(0, 10);
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + (w.ml || 0));
  }
  const waterTarget = state.waterTargetMl || 2000;
  let daysWaterHit = 0;
  for (const ml of waterByDay.values()) if (ml >= waterTarget) daysWaterHit += 1;

  const ratio = (kg: number) => (bodyweight > 0 && kg > 0 ? kg / bodyweight : 0);

  return {
    sessions: done.length,
    totalVolumeKg,
    totalSets,
    totalReps,
    totalPRs,
    currentStreak: calculateStreak(state.completedDates || []),
    longestStreak: longestStreak(state.completedDates || []),
    daysTrained: new Set(done.map((s) => s.date)).size,
    distinctExercises: exerciseIds.size,
    distinctMuscleGroups: groups.size,
    heaviestSetKg,
    biggestSessionKg,
    longestSessionSets,
    sessionsBefore7am,
    sessionsAfter9pm,
    weekendSessions,
    checkIns: (state.checkIns || []).length,
    weighIns: (state.weights || []).length,
    measurements: (state.measurements || []).length,
    programsBuilt: (state.programs || []).length,
    daysFoodLogged: kcalByDay.size,
    daysProteinHit,
    daysWaterHit,
    benchRatio: ratio(bestMatching(done, /bench/i)),
    squatRatio: ratio(bestMatching(done, /squat/i)),
    deadliftRatio: ratio(bestMatching(done, /deadlift/i)),
  };
}

interface Definition {
  id: string;
  label: string;
  desc: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  target: number;
  measure: (f: AchievementFacts) => number;
}

/**
 * The catalog. Ordered within a category by ascending difficulty so the wall
 * reads as a ladder rather than a pile.
 */
const CATALOG: Definition[] = [
  // ── Consistency ─────────────────────────────────────────────
  { id: "first-rep", label: "FIRST REP", desc: "Finish your first session", icon: "🥇", category: "CONSISTENCY", rarity: "COMMON", target: 1, measure: (f) => f.sessions },
  { id: "sessions-10", label: "WARMED UP", desc: "Finish 10 sessions", icon: "🔥", category: "CONSISTENCY", rarity: "COMMON", target: 10, measure: (f) => f.sessions },
  { id: "sessions-25", label: "HABIT FORMING", desc: "Finish 25 sessions", icon: "📈", category: "CONSISTENCY", rarity: "COMMON", target: 25, measure: (f) => f.sessions },
  { id: "sessions-50", label: "REGULAR", desc: "Finish 50 sessions", icon: "💯", category: "CONSISTENCY", rarity: "RARE", target: 50, measure: (f) => f.sessions },
  { id: "sessions-100", label: "CENTURION", desc: "Finish 100 sessions", icon: "🏛️", category: "CONSISTENCY", rarity: "EPIC", target: 100, measure: (f) => f.sessions },
  { id: "sessions-250", label: "IRON HABIT", desc: "Finish 250 sessions", icon: "⚙️", category: "CONSISTENCY", rarity: "EPIC", target: 250, measure: (f) => f.sessions },
  { id: "sessions-500", label: "LIFER", desc: "Finish 500 sessions", icon: "♾️", category: "CONSISTENCY", rarity: "LEGENDARY", target: 500, measure: (f) => f.sessions },
  { id: "streak-3", label: "ROLLING", desc: "3-day streak", icon: "🌱", category: "CONSISTENCY", rarity: "COMMON", target: 3, measure: (f) => f.longestStreak },
  { id: "streak-7", label: "ONE WEEK", desc: "7-day streak", icon: "📅", category: "CONSISTENCY", rarity: "COMMON", target: 7, measure: (f) => f.longestStreak },
  { id: "streak-14", label: "FORTNIGHT", desc: "14-day streak", icon: "🗓️", category: "CONSISTENCY", rarity: "RARE", target: 14, measure: (f) => f.longestStreak },
  { id: "streak-30", label: "UNBROKEN", desc: "30-day streak", icon: "🔗", category: "CONSISTENCY", rarity: "EPIC", target: 30, measure: (f) => f.longestStreak },
  { id: "streak-100", label: "OBSESSED", desc: "100-day streak", icon: "💀", category: "CONSISTENCY", rarity: "LEGENDARY", target: 100, measure: (f) => f.longestStreak },
  { id: "streak-365", label: "IMMORTAL", desc: "365-day streak", icon: "👑", category: "CONSISTENCY", rarity: "LEGENDARY", target: 365, measure: (f) => f.longestStreak },
  { id: "days-50", label: "FIFTY DAYS", desc: "Train on 50 different days", icon: "🗒️", category: "CONSISTENCY", rarity: "RARE", target: 50, measure: (f) => f.daysTrained },
  { id: "days-200", label: "TWO HUNDRED", desc: "Train on 200 different days", icon: "📚", category: "CONSISTENCY", rarity: "EPIC", target: 200, measure: (f) => f.daysTrained },

  // ── Tonnage ─────────────────────────────────────────────────
  { id: "tonnage-1k", label: "FIRST TONNE", desc: "Move 1,000 kg in total", icon: "🪨", category: "TONNAGE", rarity: "COMMON", target: 1_000, measure: (f) => f.totalVolumeKg },
  { id: "tonnage-10k", label: "TEN TONNES", desc: "Move 10,000 kg in total", icon: "🚙", category: "TONNAGE", rarity: "COMMON", target: 10_000, measure: (f) => f.totalVolumeKg },
  { id: "tonnage-50k", label: "HEAVY HAULER", desc: "Move 50,000 kg in total", icon: "🚛", category: "TONNAGE", rarity: "RARE", target: 50_000, measure: (f) => f.totalVolumeKg },
  { id: "tonnage-100k", label: "SIX FIGURES", desc: "Move 100,000 kg in total", icon: "🏗️", category: "TONNAGE", rarity: "EPIC", target: 100_000, measure: (f) => f.totalVolumeKg },
  { id: "tonnage-500k", label: "MOUNTAIN MOVER", desc: "Move 500,000 kg in total", icon: "⛰️", category: "TONNAGE", rarity: "LEGENDARY", target: 500_000, measure: (f) => f.totalVolumeKg },
  { id: "tonnage-1m", label: "MILLION CLUB", desc: "Move 1,000,000 kg in total", icon: "🌍", category: "TONNAGE", rarity: "LEGENDARY", target: 1_000_000, measure: (f) => f.totalVolumeKg },
  { id: "session-5k", label: "BIG DAY", desc: "5,000 kg in a single session", icon: "💪", category: "TONNAGE", rarity: "RARE", target: 5_000, measure: (f) => f.biggestSessionKg },
  { id: "session-10k", label: "MONSTER SESSION", desc: "10,000 kg in a single session", icon: "🦍", category: "TONNAGE", rarity: "EPIC", target: 10_000, measure: (f) => f.biggestSessionKg },
  { id: "sets-500", label: "FIVE HUNDRED SETS", desc: "Log 500 sets", icon: "📊", category: "TONNAGE", rarity: "RARE", target: 500, measure: (f) => f.totalSets },
  { id: "sets-2500", label: "SET MACHINE", desc: "Log 2,500 sets", icon: "🏭", category: "TONNAGE", rarity: "EPIC", target: 2_500, measure: (f) => f.totalSets },
  { id: "reps-10k", label: "TEN THOUSAND REPS", desc: "Log 10,000 reps", icon: "🔁", category: "TONNAGE", rarity: "EPIC", target: 10_000, measure: (f) => f.totalReps },
  { id: "marathon-set", label: "MARATHON", desc: "40 sets in one session", icon: "🏃", category: "TONNAGE", rarity: "RARE", target: 40, measure: (f) => f.longestSessionSets },

  // ── Strength ────────────────────────────────────────────────
  { id: "pr-1", label: "NEW GROUND", desc: "Set your first PR", icon: "⭐", category: "STRENGTH", rarity: "COMMON", target: 1, measure: (f) => f.totalPRs },
  { id: "pr-10", label: "CLIMBING", desc: "Set 10 PRs", icon: "📶", category: "STRENGTH", rarity: "COMMON", target: 10, measure: (f) => f.totalPRs },
  { id: "pr-50", label: "RECORD BREAKER", desc: "Set 50 PRs", icon: "🏆", category: "STRENGTH", rarity: "RARE", target: 50, measure: (f) => f.totalPRs },
  { id: "pr-100", label: "RELENTLESS", desc: "Set 100 PRs", icon: "🥊", category: "STRENGTH", rarity: "EPIC", target: 100, measure: (f) => f.totalPRs },
  { id: "pr-250", label: "UNSTOPPABLE", desc: "Set 250 PRs", icon: "☄️", category: "STRENGTH", rarity: "LEGENDARY", target: 250, measure: (f) => f.totalPRs },
  { id: "plate-60", label: "ONE PLATE", desc: "Lift 60 kg in a working set", icon: "🔘", category: "STRENGTH", rarity: "COMMON", target: 60, measure: (f) => f.heaviestSetKg },
  { id: "plate-100", label: "TWO PLATES", desc: "Lift 100 kg in a working set", icon: "⚫", category: "STRENGTH", rarity: "RARE", target: 100, measure: (f) => f.heaviestSetKg },
  { id: "plate-140", label: "THREE PLATES", desc: "Lift 140 kg in a working set", icon: "🎱", category: "STRENGTH", rarity: "EPIC", target: 140, measure: (f) => f.heaviestSetKg },
  { id: "plate-180", label: "FOUR PLATES", desc: "Lift 180 kg in a working set", icon: "🌑", category: "STRENGTH", rarity: "LEGENDARY", target: 180, measure: (f) => f.heaviestSetKg },
  { id: "bench-bw", label: "BENCH BODYWEIGHT", desc: "Bench your own bodyweight", icon: "🛏️", category: "STRENGTH", rarity: "RARE", target: 100, measure: (f) => Math.round(f.benchRatio * 100) },
  { id: "bench-1_5", label: "BENCH 1.5×", desc: "Bench 1.5× bodyweight", icon: "🔱", category: "STRENGTH", rarity: "LEGENDARY", target: 150, measure: (f) => Math.round(f.benchRatio * 100) },
  { id: "squat-1_5", label: "SQUAT 1.5×", desc: "Squat 1.5× bodyweight", icon: "🦵", category: "STRENGTH", rarity: "EPIC", target: 150, measure: (f) => Math.round(f.squatRatio * 100) },
  { id: "squat-2", label: "SQUAT DOUBLE", desc: "Squat 2× bodyweight", icon: "🐘", category: "STRENGTH", rarity: "LEGENDARY", target: 200, measure: (f) => Math.round(f.squatRatio * 100) },
  { id: "deadlift-2", label: "DEADLIFT DOUBLE", desc: "Deadlift 2× bodyweight", icon: "🪝", category: "STRENGTH", rarity: "EPIC", target: 200, measure: (f) => Math.round(f.deadliftRatio * 100) },
  { id: "deadlift-2_5", label: "DEADLIFT 2.5×", desc: "Deadlift 2.5× bodyweight", icon: "🗿", category: "STRENGTH", rarity: "LEGENDARY", target: 250, measure: (f) => Math.round(f.deadliftRatio * 100) },

  // ── Variety ─────────────────────────────────────────────────
  { id: "exercises-10", label: "EXPLORER", desc: "Train 10 different exercises", icon: "🧭", category: "VARIETY", rarity: "COMMON", target: 10, measure: (f) => f.distinctExercises },
  { id: "exercises-30", label: "WELL ROUNDED", desc: "Train 30 different exercises", icon: "🎯", category: "VARIETY", rarity: "RARE", target: 30, measure: (f) => f.distinctExercises },
  { id: "exercises-60", label: "ENCYCLOPEDIA", desc: "Train 60 different exercises", icon: "📖", category: "VARIETY", rarity: "EPIC", target: 60, measure: (f) => f.distinctExercises },
  { id: "muscles-all", label: "NOTHING SKIPPED", desc: "Train all 6 muscle groups", icon: "🧍", category: "VARIETY", rarity: "RARE", target: 6, measure: (f) => f.distinctMuscleGroups },
  { id: "programs-1", label: "ARCHITECT", desc: "Build a training programme", icon: "📐", category: "VARIETY", rarity: "COMMON", target: 1, measure: (f) => f.programsBuilt },
  { id: "programs-3", label: "PERIODISED", desc: "Build 3 training programmes", icon: "🗂️", category: "VARIETY", rarity: "RARE", target: 3, measure: (f) => f.programsBuilt },

  // ── Dedication ──────────────────────────────────────────────
  { id: "early-1", label: "SUNRISE SET", desc: "Train before 7am", icon: "🌅", category: "DEDICATION", rarity: "COMMON", target: 1, measure: (f) => f.sessionsBefore7am },
  { id: "early-20", label: "DAWN PATROL", desc: "Train before 7am 20 times", icon: "🐓", category: "DEDICATION", rarity: "EPIC", target: 20, measure: (f) => f.sessionsBefore7am },
  { id: "late-1", label: "NIGHT SHIFT", desc: "Train after 9pm", icon: "🌙", category: "DEDICATION", rarity: "COMMON", target: 1, measure: (f) => f.sessionsAfter9pm },
  { id: "late-20", label: "NOCTURNAL", desc: "Train after 9pm 20 times", icon: "🦉", category: "DEDICATION", rarity: "EPIC", target: 20, measure: (f) => f.sessionsAfter9pm },
  { id: "weekend-10", label: "WEEKEND WARRIOR", desc: "Train 10 weekend days", icon: "🛡️", category: "DEDICATION", rarity: "RARE", target: 10, measure: (f) => f.weekendSessions },
  { id: "weekend-50", label: "NO DAYS OFF", desc: "Train 50 weekend days", icon: "⚔️", category: "DEDICATION", rarity: "LEGENDARY", target: 50, measure: (f) => f.weekendSessions },
  { id: "checkin-1", label: "BEFORE", desc: "Take your first check-in photo", icon: "📸", category: "DEDICATION", rarity: "COMMON", target: 1, measure: (f) => f.checkIns },
  { id: "checkin-10", label: "THE RECEIPTS", desc: "Take 10 check-in photos", icon: "🖼️", category: "DEDICATION", rarity: "RARE", target: 10, measure: (f) => f.checkIns },
  { id: "weighin-30", label: "TRACKED", desc: "Log 30 bodyweight entries", icon: "⚖️", category: "DEDICATION", rarity: "RARE", target: 30, measure: (f) => f.weighIns },
  { id: "measure-5", label: "TAPE MEASURE", desc: "Log 5 measurement sets", icon: "📏", category: "DEDICATION", rarity: "COMMON", target: 5, measure: (f) => f.measurements },

  // ── Nutrition ───────────────────────────────────────────────
  { id: "food-1", label: "FIRST MEAL", desc: "Log a day of food", icon: "🍽️", category: "NUTRITION", rarity: "COMMON", target: 1, measure: (f) => f.daysFoodLogged },
  { id: "food-30", label: "MACRO MINDED", desc: "Log 30 days of food", icon: "🥗", category: "NUTRITION", rarity: "RARE", target: 30, measure: (f) => f.daysFoodLogged },
  { id: "food-100", label: "KITCHEN DISCIPLINE", desc: "Log 100 days of food", icon: "👨‍🍳", category: "NUTRITION", rarity: "EPIC", target: 100, measure: (f) => f.daysFoodLogged },
  { id: "protein-10", label: "PROTEIN HIT", desc: "Hit protein on 10 days", icon: "🥩", category: "NUTRITION", rarity: "COMMON", target: 10, measure: (f) => f.daysProteinHit },
  { id: "protein-50", label: "FED TO GROW", desc: "Hit protein on 50 days", icon: "🍗", category: "NUTRITION", rarity: "EPIC", target: 50, measure: (f) => f.daysProteinHit },
  { id: "water-20", label: "HYDRATED", desc: "Hit your water target 20 days", icon: "💧", category: "NUTRITION", rarity: "RARE", target: 20, measure: (f) => f.daysWaterHit },
];

/** Every achievement with the athlete's progress resolved. */
export function achievements(state: AppState): Achievement[] {
  const facts = achievementFacts(state);
  return CATALOG.map((d) => {
    const raw = d.measure(facts);
    const progress = Math.max(0, Math.min(d.target, Math.round(raw)));
    return {
      id: d.id,
      label: d.label,
      desc: d.desc,
      icon: d.icon,
      category: d.category,
      rarity: d.rarity,
      progress,
      target: d.target,
      unlocked: raw >= d.target,
    };
  });
}

export function unlockedIds(list: Achievement[]): string[] {
  return list.filter((a) => a.unlocked).map((a) => a.id);
}

export function achievementById(id: string): Achievement | null {
  const d = CATALOG.find((x) => x.id === id);
  if (!d) return null;
  return {
    id: d.id,
    label: d.label,
    desc: d.desc,
    icon: d.icon,
    category: d.category,
    rarity: d.rarity,
    progress: d.target,
    target: d.target,
    unlocked: true,
  };
}

export const ACHIEVEMENT_COUNT = CATALOG.length;

export const CATEGORY_ORDER: AchievementCategory[] = [
  "CONSISTENCY",
  "TONNAGE",
  "STRENGTH",
  "VARIETY",
  "DEDICATION",
  "NUTRITION",
];
