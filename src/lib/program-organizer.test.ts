import { describe, expect, it } from "vitest";

import {
  cleanFolderName,
  duplicateProgram,
  folderProgramCount,
  makeProgramFolder,
  programsForView,
  removeProgramFolder,
} from "./program-organizer";
import type { Program, ProgramFolder } from "./types";

const blankDays = () =>
  Object.fromEntries(
    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => [
      day,
      { label: "REST", items: [] },
    ]),
  ) as unknown as Program["days"];

function program(partial: Partial<Program> & Pick<Program, "id" | "name">): Program {
  return {
    splitType: "CUSTOM",
    days: blankDays(),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("program organizer", () => {
  it("cleans names and rejects empty or duplicate folders", () => {
    expect(cleanFolderName("  Push   Blocks  ")).toBe("Push Blocks");
    const first = makeProgramFolder("Push", [], { id: "f1", now: "now" });
    expect(first).toMatchObject({ id: "f1", name: "Push", accent: "RED", createdAt: "now" });
    expect(makeProgramFolder(" push ", [first!])).toBeNull();
    expect(makeProgramFolder("   ", [])).toBeNull();
  });

  it("cycles folder accents predictably", () => {
    const existing = Array.from({ length: 5 }, (_, index) => ({
      id: `f${index}`,
      name: `Folder ${index}`,
      accent: "RED" as const,
      createdAt: "now",
    }));
    expect(makeProgramFolder("Sixth", existing, { id: "f6" })?.accent).toBe("RED");
  });

  it("duplicates deeply without carrying favorite or archive state", () => {
    const source = program({ id: "p1", name: "Upper", favorite: true, archivedAt: "yesterday" });
    source.days.MON.items.push({
      id: "bench",
      name: "Bench Press",
      equipment: "barbell",
      primary_muscles: ["chest"],
      youtube_query: "bench press form",
      sets: 3,
      reps: "8",
    });
    const copy = duplicateProgram(source, { id: "p2", now: "today" });
    copy.days.MON.items[0]!.sets = 5;
    expect(copy).toMatchObject({ id: "p2", name: "Upper COPY", createdAt: "today", favorite: false });
    expect(copy.archivedAt).toBeUndefined();
    expect(source.days.MON.items[0]!.sets).toBe(3);
  });

  it("filters folders, favorites, archives and exercise-name search", () => {
    const programs = [
      program({ id: "old", name: "Old", archivedAt: "2026-02-01T00:00:00Z" }),
      program({ id: "legs", name: "Leg day", folderId: "f1", favorite: true }),
      program({ id: "push", name: "Push day", createdAt: "2026-03-01T00:00:00Z" }),
    ];
    programs[2]!.days.MON.items.push({
      id: "bench",
      name: "Bench Press",
      equipment: "barbell",
      primary_muscles: ["chest"],
      youtube_query: "bench press form",
      sets: 3,
      reps: "8",
    });
    expect(programsForView(programs, "ALL").map((item) => item.id)).toEqual(["legs", "push"]);
    expect(programsForView(programs, "FAVORITES").map((item) => item.id)).toEqual(["legs"]);
    expect(programsForView(programs, "UNFILED").map((item) => item.id)).toEqual(["push"]);
    expect(programsForView(programs, "FOLDER:f1").map((item) => item.id)).toEqual(["legs"]);
    expect(programsForView(programs, "ARCHIVED").map((item) => item.id)).toEqual(["old"]);
    expect(programsForView(programs, "ALL", "bench").map((item) => item.id)).toEqual(["push"]);
  });

  it("unfiles routines when a folder is deleted", () => {
    const folders: ProgramFolder[] = [
      { id: "f1", name: "Push", accent: "RED", createdAt: "now" },
      { id: "f2", name: "Pull", accent: "BLUE", createdAt: "now" },
    ];
    const result = removeProgramFolder(
      [program({ id: "p1", name: "A", folderId: "f1" }), program({ id: "p2", name: "B", folderId: "f2" })],
      folders,
      "f1",
      "deleted-now",
    );
    expect(result.folders.find((folder) => folder.id === "f1")?.deletedAt).toBe("deleted-now");
    expect(result.programs[0]!.folderId).toBeUndefined();
    expect(result.programs[1]!.folderId).toBe("f2");
    expect(folderProgramCount(result.programs, "f2")).toBe(1);
  });
});
