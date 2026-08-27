import { describe, expect, it } from "vitest";

import {
  formatDistance,
  formatDuration,
  formatSet,
  isTimedPersonalRecord,
  parseDurationTarget,
  setVolume,
  timedBestsFor,
  trackingModeFor,
} from "./set-tracking";
import type { CompletedSet, WorkoutSession } from "./types";

const exercise = (name: string, tracking?: "WEIGHT" | "DURATION" | "DISTANCE") => ({
  name,
  ...(tracking ? { tracking } : {}),
});

describe("trackingModeFor", () => {
  it("honours an explicit tracking field over any inference", () => {
    expect(trackingModeFor(exercise("Plank", "WEIGHT"), "45-60s")).toBe("WEIGHT");
  });

  it("reads seconds out of the prescription", () => {
    expect(trackingModeFor(exercise("Plank"), "45-60s")).toBe("DURATION");
    expect(trackingModeFor(exercise("Something"), "2 min")).toBe("DURATION");
  });

  it("infers holds and carries from the name", () => {
    expect(trackingModeFor(exercise("Farmer's Carry"))).toBe("DURATION");
    expect(trackingModeFor(exercise("Dead Hang"))).toBe("DURATION");
  });

  it("infers conditioning from the name", () => {
    expect(trackingModeFor(exercise("Treadmill Run"))).toBe("DISTANCE");
    expect(trackingModeFor(exercise("Assault Bike"))).toBe("DISTANCE");
  });

  it("leaves ordinary lifts on load x reps", () => {
    expect(trackingModeFor(exercise("Bench Press"), "6-8")).toBe("WEIGHT");
    expect(trackingModeFor(undefined)).toBe("WEIGHT");
  });

  it("does not mistake back rows or walking lunges for conditioning", () => {
    expect(trackingModeFor(exercise("Barbell Row"), "6-8")).toBe("WEIGHT");
    expect(trackingModeFor(exercise("Seated Cable Row"), "10-12")).toBe("WEIGHT");
    expect(trackingModeFor(exercise("Walking Lunge"), "10-12")).toBe("WEIGHT");
    expect(trackingModeFor(exercise("Rowing Machine"))).toBe("DISTANCE");
  });
});

describe("parseDurationTarget", () => {
  it("takes the top of a range", () => {
    expect(parseDurationTarget("45-60s")).toBe(60);
  });

  it("converts minutes", () => {
    expect(parseDurationTarget("2 min")).toBe(120);
  });

  it("returns null for rep prescriptions", () => {
    expect(parseDurationTarget("8-12")).toBeNull();
    expect(parseDurationTarget(undefined)).toBeNull();
  });
});

describe("formatting", () => {
  it("writes sub-minute holds in seconds and longer ones as clock time", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(720)).toBe("12:00");
  });

  it("switches to kilometres past a thousand metres", () => {
    expect(formatDistance(400)).toBe("400 m");
    expect(formatDistance(2000)).toBe("2 km");
    expect(formatDistance(2500)).toBe("2.50 km");
  });

  it("writes each set in its own units", () => {
    expect(formatSet({ weight: 60, reps: 8 })).toBe("60 kg × 8");
    expect(formatSet({ weight: 0, reps: 12 }, false)).toBe("12 reps");
    expect(formatSet({ weight: 0, reps: 0, mode: "duration", seconds: 60 })).toBe("1:00");
    expect(formatSet({ weight: 20, reps: 0, mode: "duration", seconds: 45 })).toBe("20 kg · 45s");
    expect(formatSet({ weight: 0, reps: 0, mode: "distance", meters: 1000, seconds: 240 })).toBe(
      "1 km · 4:00",
    );
  });
});

describe("setVolume", () => {
  it("counts ordinary working sets", () => {
    expect(setVolume({ weight: 60, reps: 8 })).toBe(480);
  });

  it("never counts warm-ups, holds or conditioning as tonnage", () => {
    expect(setVolume({ weight: 60, reps: 8, kind: "warmup" })).toBe(0);
    expect(setVolume({ weight: 20, reps: 0, mode: "duration", seconds: 60 })).toBe(0);
    expect(setVolume({ weight: 0, reps: 0, mode: "distance", meters: 5000 })).toBe(0);
  });

  it("still counts drop sets, which are real work", () => {
    expect(setVolume({ weight: 40, reps: 10, kind: "drop" })).toBe(400);
  });
});

const session = (id: string, sets: CompletedSet[]): WorkoutSession => ({
  id,
  date: "2026-01-01",
  dayKey: "MON",
  label: "Core",
  programId: null,
  startedAt: "2026-01-01T10:00:00.000Z",
  endedAt: "2026-01-01T11:00:00.000Z",
  exercises: [
    {
      exerciseId: "plank",
      name: "Plank",
      primary_muscles: ["core"],
      targetSets: 3,
      targetReps: "45-60s",
      sets,
    },
  ],
  totalVolume: 0,
  prCount: 0,
});

describe("timed bests", () => {
  it("takes the longest hold and furthest carry across sessions", () => {
    const sessions = [
      session("a", [{ weight: 0, reps: 0, mode: "duration", seconds: 60 }]),
      session("b", [
        { weight: 0, reps: 0, mode: "duration", seconds: 75 },
        { weight: 0, reps: 0, mode: "distance", meters: 400 },
      ]),
    ];
    expect(timedBestsFor(sessions, "plank")).toEqual({ seconds: 75, meters: 400 });
  });

  it("ignores the session in progress, so the set being logged cannot beat itself", () => {
    const sessions = [session("live", [{ weight: 0, reps: 0, mode: "duration", seconds: 90 }])];
    expect(timedBestsFor(sessions, "plank", "live").seconds).toBe(0);
  });

  it("excludes warm-ups and drop sets from the record", () => {
    const sessions = [
      session("a", [{ weight: 0, reps: 0, mode: "duration", seconds: 300, kind: "warmup" }]),
    ];
    expect(timedBestsFor(sessions, "plank").seconds).toBe(0);
  });
});

describe("isTimedPersonalRecord", () => {
  const bests = { seconds: 60, meters: 1000 };

  it("records a longer hold and a further effort", () => {
    expect(isTimedPersonalRecord({ mode: "duration", seconds: 61 }, bests)).toBe(true);
    expect(isTimedPersonalRecord({ mode: "distance", meters: 1200 }, bests)).toBe(true);
  });

  it("does not record matching or shorter efforts", () => {
    expect(isTimedPersonalRecord({ mode: "duration", seconds: 60 }, bests)).toBe(false);
    expect(isTimedPersonalRecord({ mode: "distance", meters: 999 }, bests)).toBe(false);
  });

  it("never records a warm-up", () => {
    expect(isTimedPersonalRecord({ mode: "duration", seconds: 600, kind: "warmup" }, bests)).toBe(
      false,
    );
  });

  it("leaves load x reps sets to the weight PR rules", () => {
    expect(isTimedPersonalRecord({ seconds: 9999 }, bests)).toBe(false);
  });
});
