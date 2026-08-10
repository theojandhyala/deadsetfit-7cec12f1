import type { WorkoutSession } from "./types";

// Session-level records — lift PRs celebrate one set; these celebrate the
// whole workout. Deterministic, computed from finished sessions only.

export interface SessionRecords {
  heaviest: { volumeKg: number; date: string; label: string } | null;
  mostReps: { reps: number; date: string; label: string } | null;
  longest: { minutes: number; date: string; label: string } | null;
  /** Which record (if any) the most recent finished session just set. */
  latestBroke: ("VOLUME" | "REPS" | "DURATION")[];
  latestDate: string | null;
}

// Same guard as lifetime stats: a timer left running must not own "longest".
const MAX_SESSION_MS = 4 * 3_600_000;

interface Metrics {
  volume: number;
  reps: number;
  minutes: number;
}

function metricsOf(s: WorkoutSession): Metrics {
  let volume = 0;
  let reps = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.kind === "warmup" || set.reps <= 0) continue;
      volume += set.weight * set.reps;
      reps += set.reps;
    }
  }
  let minutes = 0;
  const started = new Date(s.startedAt).getTime();
  const ended = new Date(s.endedAt!).getTime();
  if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) {
    minutes = Math.round(Math.min(ended - started, MAX_SESSION_MS) / 60_000);
  }
  return { volume, reps, minutes };
}

export function sessionRecords(sessions: WorkoutSession[]): SessionRecords | null {
  const finished = (sessions ?? []).filter((s) => s.endedAt);
  if (!finished.length) return null;

  let heaviest: SessionRecords["heaviest"] = null;
  let mostReps: SessionRecords["mostReps"] = null;
  let longest: SessionRecords["longest"] = null;
  let latest: WorkoutSession | null = null;
  let latestKey = "";

  for (const s of finished) {
    const m = metricsOf(s);
    if (m.volume > 0 && (!heaviest || m.volume > heaviest.volumeKg)) {
      heaviest = { volumeKg: Math.round(m.volume), date: s.date, label: s.label };
    }
    if (m.reps > 0 && (!mostReps || m.reps > mostReps.reps)) {
      mostReps = { reps: m.reps, date: s.date, label: s.label };
    }
    if (m.minutes > 0 && (!longest || m.minutes > longest.minutes)) {
      longest = { minutes: m.minutes, date: s.date, label: s.label };
    }
    // Latest by end time; date+id tiebreak keeps this deterministic.
    const key = `${s.endedAt}|${s.id}`;
    if (key > latestKey) {
      latestKey = key;
      latest = s;
    }
  }

  const latestBroke: SessionRecords["latestBroke"] = [];
  if (latest) {
    const m = metricsOf(latest);
    const others = finished.filter((s) => s.id !== latest!.id).map(metricsOf);
    const beats = (pick: (x: Metrics) => number) =>
      pick(m) > 0 && others.every((o) => pick(m) > pick(o));
    if (beats((x) => x.volume)) latestBroke.push("VOLUME");
    if (beats((x) => x.reps)) latestBroke.push("REPS");
    if (beats((x) => x.minutes)) latestBroke.push("DURATION");
  }

  return { heaviest, mostReps, longest, latestBroke, latestDate: latest?.date ?? null };
}
