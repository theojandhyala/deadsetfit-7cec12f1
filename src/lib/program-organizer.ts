import type { Program, ProgramFolder } from "./types";

export type ProgramView = "ALL" | "FAVORITES" | "UNFILED" | "ARCHIVED" | `FOLDER:${string}`;

export const PROGRAM_FOLDER_ACCENTS: ProgramFolder["accent"][] = [
  "RED",
  "ORANGE",
  "BLUE",
  "PURPLE",
  "GREEN",
];

export const PROGRAM_FOLDER_COLORS: Record<ProgramFolder["accent"], string> = {
  RED: "#e10600",
  ORANGE: "#f97316",
  BLUE: "#38bdf8",
  PURPLE: "#a855f7",
  GREEN: "#22c55e",
};

export function cleanFolderName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 28);
}

export function makeProgramFolder(
  name: string,
  existing: ProgramFolder[],
  options: { id?: string; now?: string } = {},
): ProgramFolder | null {
  const cleaned = cleanFolderName(name);
  if (!cleaned) return null;
  if (
    existing.some(
      (folder) =>
        !folder.deletedAt && folder.name.toLocaleLowerCase() === cleaned.toLocaleLowerCase(),
    )
  ) {
    return null;
  }
  return {
    id: options.id ?? crypto.randomUUID(),
    name: cleaned,
    accent: PROGRAM_FOLDER_ACCENTS[existing.length % PROGRAM_FOLDER_ACCENTS.length]!,
    createdAt: options.now ?? new Date().toISOString(),
  };
}

export function duplicateProgram(
  program: Program,
  options: { id?: string; now?: string } = {},
): Program {
  return {
    ...structuredClone(program),
    id: options.id ?? crypto.randomUUID(),
    name: `${program.name} COPY`.slice(0, 40),
    createdAt: options.now ?? new Date().toISOString(),
    favorite: false,
    archivedAt: undefined,
  };
}

function searchableText(program: Program): string {
  const exercises = Object.values(program.days)
    .flatMap((day) => [day.label, ...day.items.flatMap((item) => [item.name, ...item.primary_muscles])])
    .join(" ");
  return `${program.name} ${program.splitType} ${exercises}`.toLocaleLowerCase();
}

export function programsForView(
  programs: Program[],
  view: ProgramView,
  query = "",
): Program[] {
  const needle = query.trim().toLocaleLowerCase();
  return programs
    .filter((program) => {
      if (view === "ARCHIVED") return Boolean(program.archivedAt);
      if (program.archivedAt) return false;
      if (view === "FAVORITES") return program.favorite === true;
      if (view === "UNFILED") return !program.folderId;
      if (view.startsWith("FOLDER:")) return program.folderId === view.slice(7);
      return true;
    })
    .filter((program) => !needle || searchableText(program).includes(needle))
    .sort((left, right) => {
      if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
}

export function folderProgramCount(programs: Program[], folderId: string): number {
  return programs.filter((program) => program.folderId === folderId && !program.archivedAt).length;
}

export function removeProgramFolder(
  programs: Program[],
  folders: ProgramFolder[],
  folderId: string,
  now = new Date().toISOString(),
): { programs: Program[]; folders: ProgramFolder[] } {
  return {
    programs: programs.map((program) =>
      program.folderId === folderId ? { ...program, folderId: undefined } : program,
    ),
    folders: folders.map((folder) =>
      folder.id === folderId ? { ...folder, deletedAt: now } : folder,
    ),
  };
}
