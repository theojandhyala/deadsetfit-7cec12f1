import type { Equipment, Experience, FocusMuscle, Gender, Goal, Profile } from "./types";

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
  avatar_url?: string | null;
  public_stats?: {
    prefs?: {
      focusMuscles?: string[];
      sessionMinutes?: number;
      targetWeightKg?: number;
    };
  } | null;
};

const goals = new Set<Goal>(["BULK", "CUT", "MAINTAIN", "ATHLETIC"]);
const experiences = new Set<Experience>(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const genders = new Set<Gender>(["MALE", "FEMALE", "OTHER"]);
const equipment = new Set<Equipment>(["FULL_GYM", "HOME_GYM", "BODYWEIGHT"]);

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
    avatarDataUrl: row.avatar_url ?? undefined,
    startingWeightKg: Number(row.weight_kg ?? 75),
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
  if (typeof prefs.targetWeightKg === "number" && prefs.targetWeightKg > 0) {
    out.targetWeightKg = prefs.targetWeightKg;
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
