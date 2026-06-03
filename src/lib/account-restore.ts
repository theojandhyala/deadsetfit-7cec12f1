import type { Equipment, Experience, Gender, Goal, Profile } from "./types";

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
  };
}
