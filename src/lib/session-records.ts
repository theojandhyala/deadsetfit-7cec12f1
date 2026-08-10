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

  // Measure each session once — record scans and latestBroke reuse the result.
  const measured = finished.map((s) => ({ s, m: metricsOf(s) }));

  // Compare raw volume; round only at output so a fractionally lighter later
  // session can never steal the record from the true holder.
  let heaviest: { raw: number; date: string; label: string } | null = null;
  let mostReps: SessionRecords["mostReps"] = null;
  let longest: SessionRecords["longest"] = null;
  let latest: { s: WorkoutSession; m: Metrics } | null = null;
  let latestKey = "";

  for (const { s, m } of measured) {
    if (m.volume > 0 && (!heaviest || m.volume > heaviest.raw)) {
      heaviest = { raw: m.volume, date: s.date, label: s.label };
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
      latest = { s, m };
    }
  }

  const latestBroke: SessionRecords["latestBroke"] = [];
  if (latest) {
    const { s: latestSession, m } = latest;
    const others = measured.filter((x) => x.s.id !== latestSession.id).map((x) => x.m);
    const beats = (pick: (x: Metrics) => number) =>
      pick(m) > 0 && others.every((o) => pick(m) > pick(o));
    if (beats((x) => x.volume)) latestBroke.push("VOLUME");
    if (beats((x) => x.reps)) latestBroke.push("REPS");
    if (beats((x) => x.minutes)) latestBroke.push("DURATION");
  }

  return {
    heaviest: heaviest
      ? { volumeKg: Math.round(heaviest.raw), date: heaviest.date, label: heaviest.label }
      : null,
    mostReps,
    longest,
    latestBroke,
    latestDate: latest?.s.date ?? null,
  };
}
