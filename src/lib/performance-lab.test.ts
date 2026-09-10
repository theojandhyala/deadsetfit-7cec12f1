import { describe, expect, it } from "vitest";
import { DEFAULT_STATE } from "./default-state";
import { EXERCISES } from "./exercises";
import { strengthReport } from "./strength-grades";
import {
  evidenceMatchesGrade,
  buildPerformanceLedger,
  parsePreviewNumber,
  previewPerformance,
  rankRoadmap,
  recordForGrade,
  standardDescription,
} from "./performance-lab";
import type { AppState, CompletedSet, WorkoutSession } from "./types";

const today = "2026-09-10";
const profile: AppState["profile"] = {
  age: 30,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 3,
  goal: "BULK",
  experience: "INTERMEDIATE",
  equipment: "FULL_GYM",
};
const library = EXERCISES.map(({ id, name, muscleGroup }) => ({ id, name, muscleGroup }));
function session(
  id: string,
  date: string,
  exerciseId: string,
  sets: CompletedSet[],
  ended = true,
): WorkoutSession {
  return {
    id,
    date,
    dayKey: "MON",
    label: "Training",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: ended ? `${date}T11:00:00Z` : undefined,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      { exerciseId, name: exerciseId, primary_muscles: [], targetSets: 3, targetReps: "8", sets },
    ],
  };
}
function state(sessions: WorkoutSession[], extra: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, profile, sessions, ...extra };
}

describe("performance evidence", () => {
  it("handles no history without fabricated results", () => {
    expect(buildPerformanceLedger(state([]), library, today)).toEqual([]);
  });
  it("excludes warm-ups/drop sets and includes failure working sets", () => {
    const input = state([
      session("s", today, "bench-press", [
        { weight: 200, reps: 10, kind: "warmup" },
        { weight: 150, reps: 10, kind: "drop" },
        { weight: 60, reps: 5, kind: "failure" },
      ]),
    ]);
    const record = buildPerformanceLedger(input, library, today)[0].records[0];
    expect(record.best.value).toBe(70);
    expect(record.evidence).toHaveLength(1);
  });
  it("excludes unfinished, invalid-date and future workouts", () => {
    const sessions = [
      session("a", today, "bench-press", [{ weight: 60, reps: 5 }], false),
      session("b", "2026-02-30", "bench-press", [{ weight: 60, reps: 5 }]),
      session("c", "2026-09-11", "bench-press", [{ weight: 60, reps: 5 }]),
    ];
    expect(buildPerformanceLedger(state(sessions), library, today)).toEqual([]);
  });
  it("rejects non-finite, negative or fractional invalid rep data", () => {
    const sets = [
      { weight: NaN, reps: 10 },
      { weight: Infinity, reps: 10 },
      { weight: -1, reps: 5 },
      { weight: 10, reps: 0 },
      { weight: 10, reps: 1.5 },
      { weight: 0, reps: 0, mode: "duration", seconds: NaN },
    ] as CompletedSet[];
    expect(
      buildPerformanceLedger(state([session("s", today, "bench-press", sets)]), library, today),
    ).toEqual([]);
  });
  it("retains independent weighted, rep, hold and distance records for the same ID", () => {
    const input = state([
      session("s", today, "custom", [
        { weight: 60, reps: 5 },
        { weight: 0, reps: 15 },
        { weight: 10, reps: 0, mode: "duration", seconds: 45 },
        { weight: 0, reps: 0, mode: "distance", meters: 1500 },
      ]),
    ]);
    expect(
      buildPerformanceLedger(input, library, today)[0].records.map((record) => [
        record.metric,
        record.best.value,
      ]),
    ).toEqual([
      ["LOAD", 70],
      ["REPS", 15],
      ["HOLD", 45],
      ["DISTANCE", 1500],
    ]);
  });
  it("does not mutate history, set units or zero-rep timed sets", () => {
    const input = state([
      session("s", today, "plank", [{ weight: 0, reps: 0, mode: "duration", seconds: 45 }]),
    ]);
    const before = JSON.stringify(input);
    const ledger = buildPerformanceLedger(input, library, today);
    ledger[0].records[0].best.set.seconds = 999;
    expect(JSON.stringify(input)).toBe(before);
  });
  it("deduplicates sessions and mirrored legacy entries, not genuine repeated sets", () => {
    const workout = session("s", today, "bench-press", [
      { weight: 60, reps: 5 },
      { weight: 60, reps: 5 },
    ]);
    const input = state([workout, workout], {
      logs: [{ exerciseId: "bench-press", date: today, weight: 60, reps: 5 }] as AppState["logs"],
    });
    expect(buildPerformanceLedger(input, library, today)[0].records[0].evidence).toHaveLength(2);
  });
  it("labels check-ins and does not count them as completed training days", () => {
    const input = state([], {
      manualPRs: {
        "bench-press": { value: 60, reps: 5, date: today },
        plank: { value: 60, date: today },
        "push-ups": { value: 25, date: today },
      },
    });
    const ledger = buildPerformanceLedger(input, library, today);
    expect(
      ledger.every(
        (entry) =>
          entry.records[0].best.source === "CHECK_IN" &&
          entry.records[0].trainingDays === 0 &&
          entry.records[0].delta === null,
      ),
    ).toBe(true);
    expect(ledger.find((entry) => entry.exerciseId === "plank")?.records[0].metric).toBe("HOLD");
    expect(ledger.find((entry) => entry.exerciseId === "push-ups")?.records[0].metric).toBe("REPS");
  });
  it("prefers workout evidence when a check-in ties it", () => {
    const input = state([session("s", today, "bench-press", [{ weight: 60, reps: 5 }])], {
      manualPRs: { "bench-press": { value: 60, reps: 5, date: today } },
    });
    expect(buildPerformanceLedger(input, library, today)[0].records[0].best.source).toBe("WORKOUT");
  });
  it("compares the best matching metric on distinct training days, not check-ins", () => {
    const input = state(
      [
        session("a", "2026-09-07", "bench-press", [{ weight: 50, reps: 6 }]),
        session("b", "2026-09-09", "bench-press", [{ weight: 60, reps: 5 }]),
        session("c", "2026-09-09", "bench-press", [{ weight: 40, reps: 3 }]),
      ],
      { manualPRs: { "bench-press": { value: 100, reps: 1, date: today } } },
    );
    const record = buildPerformanceLedger(input, library, today)[0].records[0];
    expect(record.best.value).toBe(100);
    expect(record.delta).toBe(10);
    expect(record.trainingDays).toBe(2);
    expect(record.recent.map((item) => item.date)).toEqual(["2026-09-09", "2026-09-07"]);
  });
  it("never merges different exercise IDs with the same name", () => {
    const input = state([
      session("a", today, "a", [{ weight: 20, reps: 8 }]),
      session("b", today, "b", [{ weight: 50, reps: 8 }]),
    ]);
    expect(
      buildPerformanceLedger(
        input,
        [
          { id: "a", name: "Press" },
          { id: "b", name: "Press" },
        ],
        today,
      ),
    ).toHaveLength(2);
  });
  it("matches existing map values for supported weighted, bodyweight and timed grades", () => {
    const input = state([
      session("a", today, "bench-press", [{ weight: 60, reps: 5 }]),
      session("b", today, "push-ups", [{ weight: 0, reps: 25 }]),
      session("c", today, "plank", [{ weight: 0, reps: 0, mode: "duration", seconds: 60 }]),
    ]);
    const report = strengthReport(input, library);
    const ledger = buildPerformanceLedger(input, library, today);
    for (const grade of rankRoadmap(report))
      expect(
        recordForGrade(
          ledger.find((entry) => entry.exerciseId === grade.exerciseId),
          grade,
        )?.best.value,
      ).toBe(grade.value);
  });
  it("filters roadmap muscles and keeps finished ranks at the end", () => {
    const input = state([
      session("a", today, "bench-press", [{ weight: 500, reps: 1 }]),
      session("b", today, "plank", [{ weight: 0, reps: 0, mode: "duration", seconds: 45 }]),
    ]);
    const report = strengthReport(input, library);
    expect(rankRoadmap(report).at(-1)?.exerciseId).toBe("bench-press");
    expect(rankRoadmap(report, "CORE").map((item) => item.exerciseId)).toEqual(["plank"]);
  });
  it("flags map values unsupported by valid dated evidence", () => {
    const input = state([session("s", today, "bench-press", [{ weight: 60, reps: 5 }])], {
      manualPRs: { "bench-press": { value: 300, reps: 1, date: "2026-09-12" } },
    });
    const grade = rankRoadmap(strengthReport(input, library))[0];
    const record = recordForGrade(buildPerformanceLedger(input, library, today)[0], grade);
    expect(evidenceMatchesGrade(record, grade)).toBe(false);
    expect(evidenceMatchesGrade(undefined, grade)).toBe(false);
  });
  it("recognises a real matching record", () => {
    const input = state([session("s", today, "bench-press", [{ weight: 60, reps: 5 }])]);
    const grade = rankRoadmap(strengthReport(input, library))[0];
    expect(
      evidenceMatchesGrade(
        recordForGrade(buildPerformanceLedger(input, library, today)[0], grade),
        grade,
      ),
    ).toBe(true);
  });
  it("labels generic benchmarks instead of presenting them as exercise-specific", () => {
    expect(standardDescription("bench-press")).toContain("exercise-specific");
    expect(standardDescription("custom-machine")).toContain("Approximate");
  });
});

const previewArgs = {
  exerciseId: "bench-press",
  name: "Bench",
  muscle: "CHEST" as const,
  metric: "LOAD" as const,
  value: 60,
  reps: 5,
  bodyweightKg: 80,
  gender: "MALE",
};
describe("separate rank preview", () => {
  it("uses the same estimate and grade as the existing map", () => {
    const result = previewPerformance(previewArgs);
    expect(result).toMatchObject({ ok: true, value: 70, grade: { value: 70, tier: "NOVICE" } });
  });
  it.each([0, 13, 500, 1.5, NaN])("does not inflate a preview using %s reps", (reps) => {
    expect(previewPerformance({ ...previewArgs, reps }).ok).toBe(false);
  });
  it.each([0, -1, NaN, Infinity])("rejects invalid value %s", (value) => {
    expect(previewPerformance({ ...previewArgs, value }).ok).toBe(false);
  });
  it("keeps distance as a personal metric without inventing a strength grade", () => {
    expect(previewPerformance({ ...previewArgs, metric: "DISTANCE", value: 2000 })).toEqual({
      ok: true,
      value: 2000,
      grade: null,
    });
  });
  it("does not invent profile calibration", () => {
    expect(previewPerformance({ ...previewArgs, bodyweightKg: 0 })).toMatchObject({
      ok: true,
      grade: null,
    });
    expect(previewPerformance({ ...previewArgs, gender: "OTHER" })).toMatchObject({
      ok: true,
      grade: null,
    });
  });
  it("allows whole bodyweight reps but not fractional reps", () => {
    expect(previewPerformance({ ...previewArgs, metric: "REPS", value: 45 }).ok).toBe(true);
    expect(previewPerformance({ ...previewArgs, metric: "REPS", value: 4.5 }).ok).toBe(false);
  });
  it("does not modify preview arguments", () => {
    const original = { ...previewArgs };
    previewPerformance(original);
    expect(original).toEqual(previewArgs);
  });
});

describe("mobile numeric parsing", () => {
  it.each([
    ["12.5", 12.5],
    ["12,5", 12.5],
    [" .5 ", 0.5],
    ["60", 60],
  ])("accepts %s", (input, expected) => {
    expect(parsePreviewNumber(input as string)).toBe(expected);
  });
  it.each(["", "1e3", "12kg", "-5", "Infinity", "1.2.3", "2,5,5"])(
    "rejects %s without partial parsing",
    (input) => {
      expect(parsePreviewNumber(input)).toBeNaN();
    },
  );
});
