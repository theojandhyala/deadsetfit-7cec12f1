// Superset suggestions — antagonist push/pull pairs from today's own plan.
// One muscle rests while the other works: the same session, ~10 minutes
// shorter. Classification is deterministic keyword + muscle-group matching.

export interface SupersetPair {
  push: string;
  pull: string;
}

const PULL_WORDS = ["row", "curl", "pulldown", "pull-up", "pullup", "pull up", "chin", "face pull"];
const PUSH_WORDS = ["press", "push", "dip", "extension", "pushdown", "fly", "flye", "raise"];
// Heavy hinge/squat compounds are too systemically taxing to superset.
const EXCLUDE_WORDS = ["squat", "deadlift", "lunge", "leg press", "hip thrust"];

type Role = "PUSH" | "PULL" | null;

function classify(name: string, muscle?: string): Role {
  const n = name.toLowerCase();
  if (EXCLUDE_WORDS.some((w) => n.includes(w))) return null;
  if (PULL_WORDS.some((w) => n.includes(w))) return "PULL";
  if (PUSH_WORDS.some((w) => n.includes(w))) return "PUSH";
  const m = (muscle ?? "").toLowerCase();
  if (m.includes("back") || m.includes("lat") || m.includes("bicep")) return "PULL";
  if (m.includes("chest") || m.includes("pec") || m.includes("shoulder") || m.includes("tricep"))
    return "PUSH";
  return null;
}

export function supersetPairs(exercises: { name: string; muscle?: string }[]): SupersetPair[] {
  const pushes: string[] = [];
  const pulls: string[] = [];
  for (const ex of exercises ?? []) {
    const role = classify(ex.name, ex.muscle);
    if (role === "PUSH") pushes.push(ex.name);
    else if (role === "PULL") pulls.push(ex.name);
  }
  const pairs: SupersetPair[] = [];
  const n = Math.min(pushes.length, pulls.length, 2);
  for (let i = 0; i < n; i++) {
    pairs.push({ push: pushes[i], pull: pulls[i] });
  }
  return pairs;
}
