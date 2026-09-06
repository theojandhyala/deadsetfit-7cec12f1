import { describe, expect, it } from "vitest";

import { buildWorkoutCsv } from "./export";
import type { CompletedSet, WorkoutSession } from "./types";

function session(sets: CompletedSet[], overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "s1",
    date: "2026-08-27",
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: "2026-08-27T10:00:00.000Z",
    endedAt: "2026-08-27T11:00:00.000Z",
    exercises: [
      {
        exerciseId: "bench-press",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 3,
        targetReps: "6-8",
        sets,
      },
    ],
    totalVolume: 0,
    prCount: 0,
    ...overrides,
  };
}

const rows = (csv: string) => csv.split("\n");
const header = (csv: string) => rows(csv)[0]!.split(",");
const cell = (csv: string, row: number, column: string) =>
  rows(csv)[row]!.split(",")[header(csv).indexOf(column)];

describe("buildWorkoutCsv", () => {
  it("excludes sessions that were never finished", () => {
    const csv = buildWorkoutCsv([session([{ weight: 60, reps: 8 }], { endedAt: undefined })]);
    expect(rows(csv)).toHaveLength(1);
  });

  it("writes an ordinary working set", () => {
    const csv = buildWorkoutCsv([session([{ weight: 60, reps: 8, rpe: 8 }])]);
    expect(cell(csv, 1, "set_type")).toBe("working");
    expect(cell(csv, 1, "weight_kg")).toBe("60");
    expect(cell(csv, 1, "reps")).toBe("8");
    expect(cell(csv, 1, "rpe")).toBe("8");
  });

  it("names warm-up, drop and failure sets rather than flattening them", () => {
    const csv = buildWorkoutCsv([
      session([
        { weight: 40, reps: 10, kind: "warmup" },
        { weight: 50, reps: 6, kind: "drop" },
        { weight: 60, reps: 8, kind: "failure" },
      ]),
    ]);
    expect([1, 2, 3].map((r) => cell(csv, r, "set_type"))).toEqual(["warmup", "drop", "failure"]);
  });

  it("keeps a hold's duration instead of exporting it as zero reps", () => {
    const csv = buildWorkoutCsv([session([{ weight: 0, reps: 0, mode: "duration", seconds: 62 }])]);
    expect(cell(csv, 1, "set_type")).toBe("hold");
    expect(cell(csv, 1, "seconds")).toBe("62");
  });

  it("keeps a distance effort's metres and time", () => {
    const csv = buildWorkoutCsv([
      session([{ weight: 0, reps: 0, mode: "distance", meters: 2000, seconds: 480 }]),
    ]);
    expect(cell(csv, 1, "set_type")).toBe("distance");
    expect(cell(csv, 1, "meters")).toBe("2000");
    expect(cell(csv, 1, "seconds")).toBe("480");
  });

  it("marks personal records", () => {
    const csv = buildWorkoutCsv([session([{ weight: 100, reps: 5, isPR: true }])]);
    expect(cell(csv, 1, "pr")).toBe("yes");
  });

  it("keeps every row the same width as the header", () => {
    const csv = buildWorkoutCsv([
      session([
        { weight: 60, reps: 8 },
        { weight: 0, reps: 0, mode: "duration", seconds: 45 },
        { weight: 40, reps: 12, kind: "warmup" },
      ]),
    ]);
    const width = header(csv).length;
    for (const row of rows(csv)) expect(row.split(",")).toHaveLength(width);
  });
});
