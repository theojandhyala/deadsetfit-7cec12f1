import { describe, expect, it } from "vitest";
import { parseWorkoutCsv } from "./import-workouts";

describe("parseWorkoutCsv", () => {
  it("imports DEADSET CSV and preserves repeated sets", () => {
    const csv = [
      "date,workout,exercise,set,reps,weight_kg,rpe,pr",
      "2026-09-01,Push,Bench Press,1,8,80,8,no",
      "2026-09-01,Push,Bench Press,2,8,80,8,no",
    ].join("\n");
    const result = parseWorkoutCsv(csv);
    expect(result.source).toBe("DEADSET");
    expect(result.sessions[0].exercises[0].sets).toHaveLength(2);
    expect(result.sessions[0].totalVolume).toBe(1280);
  });

  it("recognizes Hevy columns and quoted workout names", () => {
    const csv = [
      "title,start_time,exercise_title,set_index,set_type,weight_kg,reps,rpe",
      '"Push, Heavy",2026-09-02 18:00:00,Incline Dumbbell Press,0,normal,30,10,8.5',
    ].join("\n");
    const result = parseWorkoutCsv(csv);
    expect(result.source).toBe("HEVY");
    expect(result.sessions[0].label).toBe("Push, Heavy");
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({ weight: 30, reps: 10, rpe: 8.5 });
  });

  it("converts explicitly labelled pounds to kilograms", () => {
    const csv = "date,workout,exercise,reps,weight_lb\n2026-09-03,Pull,Row,8,220.46226218";
    expect(parseWorkoutCsv(csv).sessions[0].exercises[0].sets[0].weight).toBe(100);
  });
});
