/* eslint-disable react-refresh/only-export-components -- render harness, never
   bundled into the app; the mount export is the entire point of the file. */
/** Render harness only: mounts the Pro banner variants for a screenshot. */
import { createRoot } from "react-dom/client";
import { proPitch } from "@/lib/pro-pitch";
import { DEFAULT_STATE } from "@/lib/default-state";
import type { AppState } from "@/lib/types";

const lift = (m: string[]) => ({
  exerciseId: "x",
  name: "Bench",
  primary_muscles: m,
  targetSets: 3,
  targetReps: "8",
  sets: [],
});
const done = (patch: object) => ({
  id: String(Math.random()),
  date: "2026-08-01",
  label: "PUSH",
  startedAt: "2026-08-01T10:00:00Z",
  endedAt: "2026-08-01T11:00:00Z",
  exercises: [lift(["CHEST", "ARMS"])],
  totalVolume: 0,
  prCount: 0,
  ...patch,
});

const cases: [string, AppState][] = [
  ["No history yet", { ...DEFAULT_STATE } as AppState],
  ["Two muscles graded", { ...DEFAULT_STATE, sessions: [done({})] } as AppState],
  [
    "Seven records",
    {
      ...DEFAULT_STATE,
      sessions: [
        done({
          exercises: [lift(["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"])],
          prCount: 7,
        }),
      ],
    } as AppState,
  ],
];

function Banner({ label, state }: { label: string; state: AppState }) {
  const pitch = proPitch(state);
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ color: "#666", font: "11px system-ui", margin: "0 0 6px 16px" }}>{label}</p>
      <section className="pro-banner relative mx-4 overflow-hidden rounded-2xl border border-accent-red/35 bg-[#141013] p-3.5">
        <span className="pro-banner-sheen" aria-hidden />
        <div className="relative flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent-red/40 bg-accent-red/15">
            <span style={{ color: "#e63222", fontSize: 15 }}>♛</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-cap text-[9px] text-accent-red">{pitch.eyebrow}</p>
            <p className="display mt-0.5 text-base font-extrabold uppercase leading-tight text-grit">
              {pitch.headline}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">{pitch.detail}</p>
          </div>
          <span className="-mr-1 -mt-1 shrink-0 p-1.5 text-grit-dim">✕</span>
        </div>
        <span className="btn-grit relative mt-3 min-h-11 w-full">See what Pro adds ›</span>
      </section>
    </div>
  );
}

export function mount(el: HTMLElement) {
  const root = document.createElement("div");
  root.style.cssText = "width:420px;padding:20px 0;background:#0a0a0a";
  el.appendChild(root);
  createRoot(root).render(
    <>
      {cases.map(([label, state]) => (
        <Banner key={label} label={label} state={state} />
      ))}
    </>,
  );
}
