import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  folderProgramCount,
  PROGRAM_FOLDER_COLORS,
  programsForView,
  type ProgramView,
} from "@/lib/program-organizer";
import type { Program, ProgramFolder } from "@/lib/types";

type Props = {
  programs: Program[];
  folders: ProgramFolder[];
  activeProgramId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onMove: (id: string, folderId?: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
};

function viewLabel(view: ProgramView, folders: ProgramFolder[]) {
  if (view === "ALL") return "All routines";
  if (view === "FAVORITES") return "Pinned";
  if (view === "UNFILED") return "Unfiled";
  if (view === "ARCHIVED") return "Archive";
  return folders.find((folder) => `FOLDER:${folder.id}` === view)?.name ?? "Collection";
}

export function ProgramOrganizer({
  programs,
  folders,
  activeProgramId,
  onActivate,
  onDeactivate,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onArchive,
  onMove,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const [view, setView] = useState<ProgramView>("ALL");
  const [query, setQuery] = useState("");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const effectiveView =
    view.startsWith("FOLDER:") && !folders.some((folder) => `FOLDER:${folder.id}` === view)
      ? "ALL"
      : view;
  const visible = useMemo(
    () => programsForView(programs, effectiveView, query),
    [effectiveView, programs, query],
  );
  const liveCount = programs.filter((program) => !program.archivedAt).length;
  const favoriteCount = programs.filter((program) => program.favorite && !program.archivedAt).length;
  const archivedCount = programs.length - liveCount;

  return (
    <section className="mb-7" aria-labelledby="routine-library-title">
      <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#111] p-4 shadow-[0_20px_70px_rgba(0,0,0,.28)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-accent-red/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="label-cap text-[9px] text-accent-red">Routine vault</p>
            <h2 id="routine-library-title" className="display mt-1 text-2xl font-black uppercase text-grit">
              Your programmes
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">
              Pin, group and recover every training block.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateFolder}
            className="press flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 text-[10px] font-black uppercase tracking-wider text-grit"
          >
            <FolderPlus size={15} className="text-accent-red" />
            New folder
          </button>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/8 bg-black/30 p-2.5">
            <strong className="display block text-xl text-grit">{liveCount}</strong>
            <span className="label-cap text-[8px] text-grit-dim">Ready</span>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/30 p-2.5">
            <strong className="display block text-xl text-grit">{favoriteCount}</strong>
            <span className="label-cap text-[8px] text-grit-dim">Pinned</span>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/30 p-2.5">
            <strong className="display block text-xl text-grit">{folders.length}</strong>
            <span className="label-cap text-[8px] text-grit-dim">Folders</span>
          </div>
        </div>
      </div>

      {programs.length > 0 && (
        <>
          <label className="relative mt-3 block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-grit-dim"
            />
            <input
              defaultValue=""
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search routines, exercises or muscles"
              aria-label="Search routines"
              autoCapitalize="none"
              autoCorrect="off"
              className="input-grit min-h-12 pl-10 text-sm"
            />
          </label>

          <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Routine filters">
            {([
              ["ALL", "All", liveCount],
              ["FAVORITES", "Pinned", favoriteCount],
              ["UNFILED", "Unfiled", programs.filter((program) => !program.folderId && !program.archivedAt).length],
            ] as const).map(([id, label, count]) => (
              <button
                type="button"
                key={id}
                onClick={() => setView(id)}
                aria-pressed={effectiveView === id}
                className={`press min-h-11 rounded-xl border px-2 text-[9px] font-black uppercase tracking-wider ${
                  view === id
                    ? "border-accent-red bg-accent-red/12 text-grit"
                    : "border-white/8 bg-grit-card text-grit-dim"
                }`}
              >
                {label} <span className="text-accent-red">{count}</span>
              </button>
            ))}
          </div>

          {(folders.length > 0 || archivedCount > 0) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {folders.map((folder) => {
                const id = `FOLDER:${folder.id}` as const;
                const active = effectiveView === id;
                return (
                  <div
                    key={folder.id}
                    className={`flex min-w-0 items-center rounded-xl border ${
                      active ? "bg-white/[.07]" : "bg-grit-card"
                    }`}
                    style={{ borderColor: active ? PROGRAM_FOLDER_COLORS[folder.accent] : "#262626" }}
                  >
                    <button
                      type="button"
                      onClick={() => setView(id)}
                      className="press flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 text-left"
                    >
                      <Folder size={15} style={{ color: PROGRAM_FOLDER_COLORS[folder.accent] }} />
                      <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-wide text-grit">
                        {folder.name}
                      </span>
                      <span className="text-[9px] font-bold text-grit-dim">
                        {folderProgramCount(programs, folder.id)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRenameFolder(folder.id)}
                      aria-label={`Rename ${folder.name}`}
                      className="press min-h-11 px-2 text-[9px] font-black uppercase text-grit-dim"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setView("ARCHIVED")}
                  aria-pressed={effectiveView === "ARCHIVED"}
                  className={`press flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left ${
                    effectiveView === "ARCHIVED"
                      ? "border-accent-red bg-accent-red/10"
                      : "border-grit bg-grit-card"
                  }`}
                >
                  <Archive size={15} className="text-grit-dim" />
                  <span className="flex-1 text-[10px] font-black uppercase tracking-wide text-grit">
                    Archive
                  </span>
                  <span className="text-[9px] font-bold text-grit-dim">{archivedCount}</span>
                </button>
              )}
            </div>
          )}

          <div className="mb-2 mt-5 flex items-center justify-between">
            <p className="label-cap text-[10px] text-grit-dim">{viewLabel(effectiveView, folders)}</p>
            <p className="text-[10px] font-bold text-grit-dim">
              {visible.length} {visible.length === 1 ? "routine" : "routines"}
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-grit-card/50 px-5 py-8 text-center">
              <FolderOpen size={25} className="mx-auto text-grit-dim" />
              <p className="display mt-3 text-lg font-black uppercase text-grit">Nothing here yet</p>
              <p className="mt-1 text-xs text-grit-dim">
                {query ? "Try a different search." : "Move or create a routine to fill this view."}
              </p>
              {effectiveView.startsWith("FOLDER:") && (
                <button
                  type="button"
                  onClick={() => onDeleteFolder(effectiveView.slice(7))}
                  className="btn-ghost press mt-4 min-h-11 px-4 text-[10px]"
                >
                  Delete empty folder
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((program) => {
                const filled = Object.values(program.days).reduce(
                  (total, day) => total + day.items.length,
                  0,
                );
                const trainingDays = Object.values(program.days).filter(
                  (day) => day.label !== "REST",
                ).length;
                const isActive = program.id === activeProgramId;
                const actionsOpen = openActionsId === program.id;
                const folder = folders.find((item) => item.id === program.folderId);
                return (
                  <li
                    key={program.id}
                    className="overflow-hidden rounded-2xl border bg-grit-card"
                    style={{ borderColor: isActive ? "#e10600" : "#262626" }}
                  >
                    <div className="flex min-w-0 items-stretch">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(program.id)}
                        aria-label={program.favorite ? `Unpin ${program.name}` : `Pin ${program.name}`}
                        className="press flex min-h-14 w-11 shrink-0 items-center justify-center"
                      >
                        <Star
                          size={17}
                          className={program.favorite ? "fill-accent-red text-accent-red" : "text-grit-dim"}
                        />
                      </button>
                      <Link
                        to="/programs/$programId"
                        params={{ programId: program.id }}
                        className="min-w-0 flex-1 py-3 pr-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isActive && (
                            <span className="shrink-0 rounded bg-accent-red px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                              Active
                            </span>
                          )}
                          <span className="display min-w-0 truncate text-base font-extrabold uppercase text-grit">
                            {program.name}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-grit-dim">
                          {trainingDays} days · {filled} exercises
                          {folder ? ` · ${folder.name}` : ""}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpenActionsId(actionsOpen ? null : program.id)}
                        aria-expanded={actionsOpen}
                        aria-label={`Manage ${program.name}`}
                        className="press flex min-h-14 w-12 shrink-0 items-center justify-center border-l border-grit text-grit-dim"
                      >
                        {actionsOpen ? <X size={17} /> : <MoreHorizontal size={18} />}
                      </button>
                    </div>

                    {actionsOpen && (
                      <div className="animate-slide-up border-t border-grit bg-black/25 p-3">
                        {!program.archivedAt && (
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => (isActive ? onDeactivate() : onActivate(program.id))}
                              className="press flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/[.035] text-[8px] font-black uppercase tracking-wider text-grit"
                            >
                              {isActive ? <X size={15} /> : <Check size={15} className="text-accent-red" />}
                              {isActive ? "Stop using" : "Use week"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicate(program.id)}
                              className="press flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/[.035] text-[8px] font-black uppercase tracking-wider text-grit"
                            >
                              <Copy size={15} className="text-accent-red" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => onArchive(program.id, true)}
                              className="press flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/[.035] text-[8px] font-black uppercase tracking-wider text-grit"
                            >
                              <Archive size={15} className="text-accent-red" />
                              Archive
                            </button>
                          </div>
                        )}

                        {program.archivedAt ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => onArchive(program.id, false)}
                              className="press flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/8 text-[9px] font-black uppercase text-grit"
                            >
                              <ArchiveRestore size={15} className="text-accent-red" /> Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(program.id)}
                              className="press flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent-red/30 text-[9px] font-black uppercase text-accent-red"
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <p className="label-cap mb-2 text-[8px] text-grit-dim">Move to folder</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => onMove(program.id)}
                                className={`press min-h-10 truncate rounded-lg border px-2 text-[9px] font-black uppercase ${
                                  !program.folderId
                                    ? "border-accent-red text-grit"
                                    : "border-white/8 text-grit-dim"
                                }`}
                              >
                                Unfiled
                              </button>
                              {folders.map((item) => (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => onMove(program.id, item.id)}
                                  className="press min-h-10 truncate rounded-lg border px-2 text-[9px] font-black uppercase"
                                  style={{
                                    borderColor:
                                      program.folderId === item.id
                                        ? PROGRAM_FOLDER_COLORS[item.accent]
                                        : "#303030",
                                    color: program.folderId === item.id ? "#f5f5f0" : "#8a8a8a",
                                  }}
                                >
                                  {item.name}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={onCreateFolder}
                                className="press flex min-h-10 items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 px-2 text-[9px] font-black uppercase text-grit-dim"
                              >
                                <FolderPlus size={13} /> New
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(program.id)}
                                className="press flex min-h-10 items-center justify-center gap-1 rounded-lg border border-accent-red/20 px-2 text-[9px] font-black uppercase text-accent-red"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
