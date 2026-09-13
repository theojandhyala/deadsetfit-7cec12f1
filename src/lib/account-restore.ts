import type {
  DayKey,
  Equipment,
  Experience,
  FocusMuscle,
  Gender,
  Goal,
  Profile,
  Weakness,
} from "./types";

type AccountProfile = {
  onboarded?: boolean | null;
  goal?: string | null;
  experience?: string | null;
  gender?: string | null;
  age?: number | null;
  weight_kg?: number | string | null;
  height_cm?: number | string | null;
  days_per_week?: number | null;
  equipment?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  public_stats?: {
    prefs?: {
      focusMuscles?: string[];
      sessionMinutes?: number;
      exercisesPerSession?: number;
      targetWeightKg?: number;
      trainingDays?: string[];
      injuries?: string;
      weakness?: string;
      motivation?: string;
      sleepQuality?: string;
      dreamOutcome?: string;
      startingWeightKg?: number;
    };
  } | null;
};

const goals = new Set<Goal>(["BULK", "CUT", "MAINTAIN", "ATHLETIC"]);
const experiences = new Set<Experience>(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const genders = new Set<Gender>(["MALE", "FEMALE", "OTHER"]);
const equipment = new Set<Equipment>(["FULL_GYM", "HOME_GYM", "BODYWEIGHT"]);
const weaknesses = new Set<Weakness>(["STRENGTH", "CONSISTENCY", "DIET", "RECOVERY"]);
const sleepBands = new Set(["LOW", "OK", "GOOD", "GREAT"]);
const DAY_SET = new Set<DayKey>(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  fallback: T,
  timeoutMs = 3500,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function profileFromAccount(row: AccountProfile | null | undefined): Profile | null {
  if (!row?.onboarded) return null;

  const days =
    row.days_per_week === 3 ||
    row.days_per_week === 4 ||
    row.days_per_week === 5 ||
    row.days_per_week === 6
      ? row.days_per_week
      : 4;

  return {
    goal: goals.has(row.goal as Goal) ? (row.goal as Goal) : "MAINTAIN",
    experience: experiences.has(row.experience as Experience)
      ? (row.experience as Experience)
      : "BEGINNER",
    age: Number(row.age ?? 25),
    weightKg: Number(row.weight_kg ?? 75),
    heightCm: Number(row.height_cm ?? 175),
    gender: genders.has(row.gender as Gender) ? (row.gender as Gender) : "OTHER",
    daysPerWeek: days,
    equipment: equipment.has(row.equipment as Equipment)
      ? (row.equipment as Equipment)
      : "FULL_GYM",
    username: row.username ?? undefined,
    displayName: row.display_name ?? undefined,
    avatarDataUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    // startingWeightKg is deliberately NOT defaulted to the current weight.
    // Doing that told every rebuilt device the athlete had not moved a gram
    // since day one, silently wiping the whole weight journey. It is restored
    // from prefs when it was really recorded, and otherwise left absent — every
    // reader already falls back to the current weight for that case.
    ...restorePrefs(row),
  };
}

const FOCUS_SET = new Set<FocusMuscle>(["CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE"]);
const SESSION_SET = new Set([30, 45, 60, 90]);

/** Blob-only preferences mirrored into public_stats — restore them so a
 *  fresh-device account rebuild can't silently erase onboarding answers. */
function restorePrefs(row: AccountProfile): Partial<Profile> {
  const prefs = row.public_stats?.prefs;
  if (!prefs) return {};
  const out: Partial<Profile> = {};
  const muscles = (prefs.focusMuscles ?? []).filter((m): m is FocusMuscle =>
    FOCUS_SET.has(m as FocusMuscle),
  );
  if (muscles.length) out.focusMuscles = muscles;
  if (prefs.sessionMinutes && SESSION_SET.has(prefs.sessionMinutes)) {
    out.sessionMinutes = prefs.sessionMinutes as 30 | 45 | 60 | 90;
  }
  if (prefs.exercisesPerSession && [3, 4, 5, 6, 7, 8].includes(prefs.exercisesPerSession)) {
    out.exercisesPerSession = prefs.exercisesPerSession as 3 | 4 | 5 | 6 | 7 | 8;
  }
  if (typeof prefs.targetWeightKg === "number" && prefs.targetWeightKg > 0) {
    out.targetWeightKg = prefs.targetWeightKg;
  }

  // Which weekdays, not just how many. Without this a rebuilt device moves a
  // Tue/Thu/Sat lifter onto a Mon-first spread and calls it their schedule.
  const days = (prefs.trainingDays ?? []).filter((day): day is DayKey =>
    DAY_SET.has(day as DayKey),
  );
  if (days.length) out.trainingDays = days;

  // Answers that shape coaching and framing rather than the split. They were
  // asked for and then dropped on every rebuild, which is worse than never
  // asking: an injury the athlete declared quietly stopped being worked around.
  if (typeof prefs.injuries === "string" && prefs.injuries.trim()) {
    out.injuries = prefs.injuries.slice(0, 500);
  }
  if (weaknesses.has(prefs.weakness as Weakness)) out.weakness = prefs.weakness as Weakness;
  if (typeof prefs.motivation === "string" && prefs.motivation) out.motivation = prefs.motivation;
  if (sleepBands.has(prefs.sleepQuality ?? "")) {
    out.sleepQuality = prefs.sleepQuality as Profile["sleepQuality"];
  }
  if (typeof prefs.dreamOutcome === "string" && prefs.dreamOutcome) {
    out.dreamOutcome = prefs.dreamOutcome;
  }
  if (typeof prefs.startingWeightKg === "number" && prefs.startingWeightKg > 0) {
    out.startingWeightKg = prefs.startingWeightKg;
  }
  return out;
}

export function profileQuestionsComplete(row: AccountProfile | null | undefined) {
  if (!row?.onboarded) return false;
  return Boolean(
    goals.has(row.goal as Goal) &&
    experiences.has(row.experience as Experience) &&
    genders.has(row.gender as Gender) &&
    equipment.has(row.equipment as Equipment) &&
    typeof row.age === "number" &&
    Number(row.weight_kg) > 0 &&
    Number(row.height_cm) > 0 &&
    (row.days_per_week === 3 ||
      row.days_per_week === 4 ||
      row.days_per_week === 5 ||
      row.days_per_week === 6) &&
    row.username,
  );
}
