import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "@/lib/default-state";
import type { CompletedSet, DayKey, Profile, Schedule, WorkoutSession } from "@/lib/types";

import {
  applyProgrammeWeights,
  normaliseDecimalInput,
  parseDisplayWeight,
  programmeWeightRows,
} from "@/lib/programme-weight-setup";

const profile: Profile = {
  goal: "MAINTAIN",
  experience: "BEGINNER",
  age: 24,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 3,
  trainingDays: ["MON", "WED", "FRI"],
  equipment: "FULL_GYM",
};

function scheduleWith(entries: Partial<Record<DayKey, Schedule[DayKey]>>): Schedule {
  const days: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return Object.fromEntries(
    days.map((day) => [day, entries[day] ?? { label: "REST", exerciseIds: [] }]),
  ) as Schedule;
}

function completedSession(exerciseId: string, sets: CompletedSet[]): WorkoutSession {
  return {
    id: `history-${exerciseId}`,
    date: "2026-08-20",
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: "2026-08-20T10:00:00.000Z",
    endedAt: "2026-08-20T11:00:00.000Z",
    exercises: [
      {
        exerciseId,
        name: "Bench Press",
        primary_muscles: ["chest"],
        targetSets: 3,
        targetReps: "8",
        sets,
      },
    ],
    totalVolume: 0,
    prCount: 0,
  };
}

describe("programmeWeightRows", () => {
  it("asks once for a repeated weighted movement and lists every day it fills", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      schedule: scheduleWith({
        MON: { label: "PUSH", exerciseIds: ["bench-press"] },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: "bench-press",
      days: ["MON", "FRI"],
      autoApply: false,
    });
  });

  it("silently fills a missing repeat only when one configured load is unambiguous", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      schedule: scheduleWith({
        MON: {
          label: "PUSH",
          exerciseIds: ["bench-press"],
          exerciseConfig: { "bench-press": { weightKg: 80 } },
        },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exerciseId: "bench-press", weightKg: 80, autoApply: true });
  });

  it("requires confirmation when configured repeats conflict", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      schedule: scheduleWith({
        MON: {
          label: "PUSH",
          exerciseIds: ["bench-press"],
          exerciseConfig: { "bench-press": { weightKg: 80 } },
        },
        WED: {
          label: "PUSH",
          exerciseIds: ["bench-press"],
          exerciseConfig: { "bench-press": { weightKg: 90 } },
        },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    });

    expect(rows[0]).toMatchObject({ exerciseId: "bench-press", weightKg: 80, autoApply: false });
  });

  it("prefills the latest real working load from history but waits for confirmation", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      schedule: scheduleWith({ MON: { label: "PUSH", exerciseIds: ["bench-press"] } }),
      sessions: [
        completedSession("bench-press", [
          { weight: 40, reps: 8, kind: "warmup" },
          { weight: 100, reps: 6 },
          { weight: 60, reps: 12, kind: "drop" },
        ]),
      ],
    });

    expect(rows[0]).toMatchObject({ exerciseId: "bench-press", weightKg: 100, autoApply: false });
  });

  it("does not demand fake loads for bodyweight or timed movements", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      schedule: scheduleWith({
        MON: { label: "BODYWEIGHT", exerciseIds: ["push-ups", "plank"] },
      }),
    });

    expect(rows).toEqual([]);
  });

  it("recognises lowercase bodyweight equipment in an active programme", () => {
    const rows = programmeWeightRows({
      ...DEFAULT_STATE,
      activeProgramId: "bodyweight-plan",
      programs: [
        {
          id: "bodyweight-plan",
          name: "Bodyweight",
          splitType: "CUSTOM",
          createdAt: "2026-08-20T10:00:00.000Z",
          days: Object.fromEntries(
            (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as DayKey[]).map((day) => [
              day,
              {
                label: day === "MON" ? "BACK" : "REST",
                items:
                  day === "MON"
                    ? [
                        {
                          id: "bodyweight-back-extension",
                          name: "Back Extension",
                          equipment: "bodyweight",
                          primary_muscles: ["back"],
                          youtube_query: "back extension",
                          sets: 3,
                          reps: "12",
                        },
                      ]
                    : [],
              },
            ]),
          ) as never,
        },
      ],
    });

    expect(rows).toEqual([]);
  });
});

describe("applyProgrammeWeights", () => {
  it("fills only empty repeats automatically and preserves existing loads", () => {
    const state = {
      ...DEFAULT_STATE,
      profile,
      schedule: scheduleWith({
        MON: {
          label: "PUSH",
          exerciseIds: ["bench-press"],
          exerciseConfig: { "bench-press": { weightKg: 80 } },
        },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    };
    const next = applyProgrammeWeights(state, new Map([["bench-press", 100]]), {
      fillMissingOnly: true,
    });

    expect(next.schedule?.MON.exerciseConfig?.["bench-press"]?.weightKg).toBe(80);
    expect(next.schedule?.FRI.exerciseConfig?.["bench-press"]?.weightKg).toBe(100);
  });

  it("uses a confirmed answer for every exact repeat", () => {
    const state = {
      ...DEFAULT_STATE,
      profile,
      schedule: scheduleWith({
        MON: {
          label: "PUSH",
          exerciseIds: ["bench-press"],
          exerciseConfig: { "bench-press": { weightKg: 80 } },
        },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    };
    const next = applyProgrammeWeights(state, new Map([["bench-press", 90]]));

    expect(next.schedule?.MON.exerciseConfig?.["bench-press"]?.weightKg).toBe(90);
    expect(next.schedule?.FRI.exerciseConfig?.["bench-press"]?.weightKg).toBe(90);
  });
});

describe("parseDisplayWeight", () => {
  it("accepts dot and comma decimals from iOS keyboards", () => {
    expect(parseDisplayWeight("62.5")).toBe(62.5);
    expect(parseDisplayWeight("62,5")).toBe(62.5);
  });

  it("normalises locale decimals without multiplying the value", () => {
    expect(normaliseDecimalInput("62,5")).toBe("62.5");
    expect(normaliseDecimalInput("62..5")).toBe("62.5");
  });

  it("rejects empty, zero and malformed values with no guess", () => {
    expect(parseDisplayWeight("")).toBeNull();
    expect(parseDisplayWeight("0")).toBeNull();
    expect(parseDisplayWeight("60kg")).toBeNull();
  });
});
