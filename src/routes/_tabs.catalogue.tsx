import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, Camera, Trophy, Flame, Dumbbell, Scale, X } from "lucide-react";
import { Share2 } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { calculateStreak } from "@/lib/calc";
import { topSetHistory } from "@/lib/progression";
import { WeeklyRecapCard, type WeeklyRecap } from "@/components/WeeklyRecapCard";
import { PRShareCard } from "@/components/PRShareCard";
import type { PRShareDetails } from "@/lib/grit-events";

// Tiny inline progression chart — top-set weight over recent sessions.
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 84;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / span) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "#e63222" : "#8A8A8A";
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * (w - 4) + 2;
        const y = h - 2 - ((v - min) / span) * (h - 6);
        return (
          <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 2.5 : 1.5} fill={color} />
        );
      })}
    </svg>
  );
}

export const Route = createFileRoute("/_tabs/catalogue")({
  head: () => ({ meta: [{ title: "DEADSET — Your Journey" }] }),
  component: CataloguePage,
});

function daysBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CataloguePage() {
  const [state, set] = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const photos = useMemo(
    () => [...state.checkIns].sort((a, b) => a.date.localeCompare(b.date)),
    [state.checkIns],
  );
  const first = photos[0];
  const latest = photos[photos.length - 1];
  const weeksApart =
    first && latest && first !== latest
      ? Math.max(1, Math.round(daysBetween(first.date, latest.date) / 7))
      : 0;

  const prs = useMemo(() => {
    const m = state.manualPRs ?? {};
    return Object.entries(m)
      .map(([id, pr]) => ({
        id,
        name: getExercise(id, state.savedExercises)?.name ?? id,
        ...pr,
        // Top-set weight per session over time — powers the climb sparkline.
        history: topSetHistory(state, id, 8)
          .map((t) => t.weight)
          .filter((w) => w > 0),
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [state]);

  const streak = calculateStreak(state.completedDates);
  const sessions = state.sessions.filter((s) => s.endedAt).length;
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [sharePr, setSharePr] = useState<PRShareDetails | null>(null);

  function buildWeeklyRecap(): WeeklyRecap {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const wk = state.sessions.filter((s) => s.endedAt && (s.startedAt || s.date) >= weekAgo);
    const volumeKg = wk.reduce((a, s) => a + (s.totalVolume || 0), 0);
    const prs = wk.reduce((a, s) => a + (s.prCount || 0), 0);
    let topLift: WeeklyRecap["topLift"];
    let best = 0;
    for (const s of wk) {
      for (const e of s.exercises) {
        for (const set of e.sets) {
          if (set.weight > best) {
            best = set.weight;
            topLift = {
              name: getExercise(e.exerciseId, state.savedExercises)?.name ?? e.name,
              value: set.weight,
            };
          }
        }
      }
    }
    return {
      weekLabel: now.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      sessions: wk.length,
      volumeKg,
      prs,
      streak,
      topLift,
    };
  }

  // Journey start = the earliest thing we can find (photo, session, or weigh-in).
  const journeyStart = useMemo(() => {
    const dates: string[] = [];
    if (photos[0]) dates.push(photos[0].date);
    const firstSession = [...state.sessions].sort((a, b) =>
      (a.startedAt || "").localeCompare(b.startedAt || ""),
    )[0];
    if (firstSession?.startedAt) dates.push(firstSession.startedAt);
    const firstWeight = [...state.weights].sort((a, b) => a.date.localeCompare(b.date))[0];
    if (firstWeight) dates.push(firstWeight.date);
    return dates.sort()[0] ?? null;
  }, [photos, state.sessions, state.weights]);
  const daysTraining = journeyStart ? daysBetween(journeyStart, new Date().toISOString()) : 0;

  const weightNow =
    [...state.weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight ??
    state.profile?.weightKg;
  const weightStart =
    state.profile?.startingWeightKg ??
    [...state.weights].sort((a, b) => a.date.localeCompare(b.date))[0]?.weight ??
    weightNow;
  const weightDelta =
    weightNow != null && weightStart != null
      ? Math.round((weightNow - weightStart) * 10) / 10
      : null;

  function addPhoto(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      set((s) => ({
        ...s,
        checkIns: [...s.checkIns, { date: new Date().toISOString(), photoDataUrl: dataUrl }],
      }));
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  const stats: { icon: typeof Flame; label: string; value: string }[] = [
    { icon: Flame, label: "Day streak", value: String(streak) },
    { icon: Dumbbell, label: "Sessions", value: String(sessions) },
    { icon: Trophy, label: "PRs set", value: String(prs.length) },
    {
      icon: Scale,
      label: "Body change",
      value: weightDelta == null ? "—" : `${weightDelta > 0 ? "+" : ""}${weightDelta}kg`,
    },
  ];

  return (
    <div className="min-h-screen bg-grit pb-28" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])}
      />

      <header className="px-5 pt-10 pb-4 flex items-center gap-3">
        <Link
          to="/progress"
          aria-label="Back"
          className="tap-44 -ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-grit bg-grit-card text-grit-dim press"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <p className="label-cap text-accent-red text-[10px]">The Catalogue</p>
          <h1 className="display text-3xl font-extrabold uppercase text-white leading-none">
            Your Journey
          </h1>
        </div>
      </header>

      {daysTraining > 0 && (
        <p className="px-5 -mt-1 mb-4 text-xs text-grit-dim">
          {daysTraining} {daysTraining === 1 ? "day" : "days"} of work logged and counting.
        </p>
      )}

      {sessions > 0 && (
        <div className="px-5 mb-5">
          <button onClick={() => setRecap(buildWeeklyRecap())} className="btn-ghost w-full py-3">
            <Share2 size={16} className="mr-2" /> Share your week
          </button>
        </div>
      )}

      {/* Journey stats */}
      <section className="px-5 mb-6 grid grid-cols-4 gap-2 animate-slide-up">
        {stats.map((s) => (
          <div
            key={s.label}
            className="deadset-3d-panel bg-grit-card border border-grit p-3 text-center"
          >
            <s.icon size={16} className="mx-auto mb-1" style={{ color: "#e63222" }} />
            <p className="display text-xl font-extrabold text-white leading-none">{s.value}</p>
            <p className="label-cap text-[8px] text-grit-dim mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Before / after hero */}
      <section className="px-5 mb-8 animate-slide-up delay-50">
        <div className="deadset-section-title mb-2">
          <h2 className="display text-xl font-extrabold uppercase text-grit leading-none">
            Before → Now
          </h2>
        </div>
        {photos.length >= 2 ? (
          <div className="deadset-3d-panel border border-grit bg-[#080808] p-3">
            <div className="grid grid-cols-2 gap-2">
              {[first, latest].map((p, i) => (
                <button
                  key={p.date}
                  onClick={() => setLightbox(p.photoDataUrl)}
                  className="text-left press"
                >
                  <div className="relative">
                    <img
                      src={p.photoDataUrl}
                      alt=""
                      className="w-full aspect-[3/4] object-cover rounded-lg"
                    />
                    <span className="absolute top-2 left-2 label-cap text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white">
                      {i === 0 ? "BEFORE" : "NOW"}
                    </span>
                  </div>
                  <p className="text-[10px] text-grit-dim mt-1.5 text-center">{fmtDate(p.date)}</p>
                </button>
              ))}
            </div>
            {weeksApart > 0 && (
              <p className="text-center label-cap text-accent-red text-[10px] mt-3">
                {weeksApart} {weeksApart === 1 ? "week" : "weeks"} of forging
              </p>
            )}
          </div>
        ) : photos.length === 1 ? (
          <div className="deadset-3d-panel border border-grit bg-[#080808] p-3">
            <button
              onClick={() => setLightbox(first.photoDataUrl)}
              className="w-1/2 mx-auto block press"
            >
              <img
                src={first.photoDataUrl}
                alt=""
                className="w-full aspect-[3/4] object-cover rounded-lg"
              />
              <p className="text-[10px] text-grit-dim mt-1.5 text-center">{fmtDate(first.date)}</p>
            </button>
            <p className="text-center text-xs text-grit-dim mt-3">
              Your first shot is in. Add another later to see the change side by side.
            </p>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="deadset-3d-panel border border-dashed border-grit bg-grit-card w-full p-8 text-center press"
          >
            <Camera size={28} className="mx-auto mb-3" style={{ color: "#e63222" }} />
            <p className="display text-lg font-extrabold uppercase text-grit">
              Start your before shot
            </p>
            <p className="text-xs text-grit-dim mt-1">The photo you'll be glad you took.</p>
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} className="btn-grit w-full mt-3">
          <Camera size={16} className="mr-2" /> Add progress photo
        </button>
      </section>

      {/* Photo timeline */}
      {photos.length > 0 && (
        <section className="px-5 mb-8 animate-slide-up delay-100">
          <div className="deadset-section-title mb-2">
            <h2 className="display text-xl font-extrabold uppercase text-grit leading-none">
              Timeline
            </h2>
            <span className="label-cap text-grit-dim">{photos.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...photos].reverse().map((p) => (
              <button key={p.date} onClick={() => setLightbox(p.photoDataUrl)} className="press">
                <img
                  src={p.photoDataUrl}
                  alt=""
                  className="w-full aspect-[3/4] object-cover rounded-lg"
                />
                <p className="text-[9px] text-grit-dim mt-1 text-center">{fmtDate(p.date)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PR wall */}
      <section className="px-5 mb-6 animate-slide-up delay-150">
        <div className="deadset-section-title mb-2">
          <h2 className="display text-xl font-extrabold uppercase text-grit leading-none">
            PR Wall
          </h2>
          <span className="label-cap text-grit-dim">{prs.length}</span>
        </div>
        {prs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {prs.map((pr) => (
              <div
                key={pr.id}
                className="deadset-3d-panel bg-grit-card border border-grit p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="display text-base font-extrabold uppercase text-white leading-none truncate">
                    {pr.name}
                  </p>
                  <p className="text-[10px] text-grit-dim mt-1">
                    {pr.date ? fmtDate(pr.date) : "—"}
                    {pr.reps ? ` · ${pr.reps} reps` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {pr.history.length >= 2 && <Sparkline values={pr.history} />}
                  <div className="text-right">
                    <p className="display text-2xl font-extrabold text-accent-red leading-none">
                      {pr.value}
                    </p>
                    <p className="label-cap text-[8px] text-grit-dim">kg</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSharePr({
                        exercise: pr.name,
                        weight: pr.value,
                        reps: pr.reps ?? 0,
                        // No delta here: the wall keeps the record, not the
                        // number it beat, and a guessed one would overstate it.
                      })
                    }
                    aria-label={`Share ${pr.name} PR`}
                    className="icon-btn min-h-[44px] min-w-[44px] flex items-center justify-center text-grit-dim"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="deadset-3d-panel bg-grit-card border border-grit p-6 text-center">
            <Trophy size={24} className="mx-auto mb-2 text-grit-dim" />
            <p className="text-sm text-grit-dim">
              No PRs yet. Log a workout and hit a lift you've never done — it lands here.
            </p>
            <Link to="/train" className="btn-ghost mt-4 inline-block px-6">
              Go train
            </Link>
          </div>
        )}
      </section>

      {lightbox && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            aria-label="Close"
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full border border-grit bg-grit-card text-grit press"
            onClick={() => setLightbox(null)}
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}

      {recap && <WeeklyRecapCard recap={recap} onClose={() => setRecap(null)} />}
      {sharePr && (
        <PRShareCard
          pr={sharePr}
          displayName={state.profile?.displayName || state.profile?.username || "Athlete"}
          username={state.profile?.username}
          onClose={() => setSharePr(null)}
        />
      )}
    </div>
  );
}
