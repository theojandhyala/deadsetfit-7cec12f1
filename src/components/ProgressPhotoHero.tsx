import { Camera, ChevronRight, Share2, Sparkles } from "lucide-react";

import { hapticSelection } from "@/lib/haptics";
import { daysSinceLastCheckIn, isCheckInDue, photoJourney, spanLabel } from "@/lib/progress-photos";
import type { CheckIn, WeightEntry } from "@/lib/types";
import { formatWeight, type WeightUnit } from "@/lib/units";

/**
 * Progress photos, at the top of the screen instead of the bottom of it.
 *
 * This is the app's most persuasive artefact and it was a small grid below the
 * fold, behind a ghost button labelled "Weekly Check-in" — a feature you had to
 * already know about to find. Nobody scrolls past a strength chart looking for
 * a camera.
 *
 * Three states, because a person with no photos, one photo and a real
 * comparison need three different things said to them: a reason to start, a
 * reason to come back, and their own before-and-after.
 */
export function ProgressPhotoHero({
  checkIns,
  weights,
  unit,
  onCapture,
  onShare,
  onOpenAll,
}: {
  checkIns: CheckIn[];
  weights: WeightEntry[];
  unit: WeightUnit;
  onCapture: () => void;
  onShare: () => void;
  onOpenAll: () => void;
}) {
  const journey = photoJourney({ checkIns, weights });
  const since = daysSinceLastCheckIn({ checkIns });
  // Via the shared helper rather than re-comparing against the interval here,
  // so the prompt and the rest of the app can never disagree about "due".
  const due = isCheckInDue({ checkIns });

  if (journey.count === 0) {
    return (
      <section className="px-5 mt-4">
        <div className="deadset-photo-hero relative overflow-hidden rounded-2xl border border-accent-red/30 bg-grit-card p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-red/10 blur-2xl" />
          <p className="label-cap text-[10px] text-accent-red">PROGRESS PHOTOS</p>
          <h2 className="display mt-1 text-2xl font-extrabold uppercase leading-tight text-grit">
            The mirror lies. The camera doesn&apos;t.
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-grit-dim">
            Scale weight moves for reasons that have nothing to do with training, and nobody sees
            their own change in a mirror they look into every day. Two photos eight weeks apart
            settle it. Take the first one now — it only works if you start.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <PhotoSlot label="TODAY" />
            <ChevronRight size={16} className="shrink-0 text-grit-dim" />
            <PhotoSlot label="8 WEEKS" dashed />
          </div>

          <button
            onClick={() => {
              hapticSelection();
              onCapture();
            }}
            className="btn-grit mt-4 w-full min-h-12"
          >
            <Camera size={16} className="mr-2" />
            Take my first check-in
          </button>
          <p className="mt-2 text-center text-[10px] text-grit-dim">
            Stored on your device, in your account. Never posted anywhere unless you share it.
          </p>
        </div>
      </section>
    );
  }

  if (!journey.meaningful) {
    return (
      <section className="px-5 mt-4">
        <div className="rounded-2xl border border-grit bg-grit-card p-4">
          <div className="flex items-start gap-3">
            <img
              src={journey.latest?.photoDataUrl}
              alt=""
              className="h-24 w-[72px] shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="label-cap text-[10px] text-accent-red">PROGRESS PHOTOS</p>
              <p className="display mt-0.5 text-lg font-extrabold uppercase leading-tight text-grit">
                {journey.count === 1 ? "First one banked" : `${journey.count} check-ins in`}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">
                {due
                  ? `It has been ${since} days. Take the next one — the comparison is what makes this worth doing.`
                  : "Come back weekly. The before-and-after unlocks once two shots are a fortnight apart."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                hapticSelection();
                onCapture();
              }}
              className={`min-h-11 flex-1 ${due ? "btn-grit" : "btn-ghost"}`}
            >
              <Camera size={15} className="mr-2" />
              {due ? "Check in now" : "Add a check-in"}
            </button>
            <button onClick={onOpenAll} className="btn-ghost min-h-11 px-4">
              All photos
            </button>
          </div>
        </div>
      </section>
    );
  }

  const delta = journey.weightDeltaKg;

  return (
    <section className="px-5 mt-4">
      <div className="overflow-hidden rounded-2xl border border-grit bg-grit-card">
        <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <p className="label-cap text-[9px] text-grit-dim">PROGRESS PHOTOS</p>
            <p className="display text-base font-extrabold uppercase text-grit">Look at yourself</p>
          </div>
          <p className="label-cap text-right text-[8px] text-accent-red">
            {spanLabel(journey.daysApart)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-0.5 border-y border-grit bg-black">
          <PhotoPane
            src={journey.first!.photoDataUrl}
            caption="BEFORE"
            date={journey.first!.date}
          />
          <PhotoPane src={journey.latest!.photoDataUrl} caption="NOW" date={journey.latest!.date} />
        </div>

        {delta !== null && delta !== 0 && (
          <p className="px-4 pt-3 text-center text-xs text-grit">
            <span
              className="display font-extrabold"
              style={{ color: delta > 0 ? "#e63222" : "#22c55e" }}
            >
              {delta > 0 ? "+" : ""}
              {formatWeight(delta, unit)}
            </span>{" "}
            <span className="text-grit-dim">bodyweight across the span</span>
          </p>
        )}

        <div className="flex gap-2 p-4">
          <button onClick={onShare} className="btn-grit min-h-11 flex-1">
            <Share2 size={15} className="mr-2" />
            Share before / after
          </button>
          <button
            onClick={() => {
              hapticSelection();
              onCapture();
            }}
            className={`min-h-11 px-4 ${due ? "btn-grit" : "btn-ghost"}`}
            aria-label="Add a check-in"
          >
            <Camera size={15} />
          </button>
        </div>

        {due && (
          <p className="flex items-center justify-center gap-1.5 px-4 pb-4 text-[10px] text-grit-dim">
            <Sparkles size={11} className="text-accent-red" />
            {since} days since your last one.
          </p>
        )}
      </div>
    </section>
  );
}

function PhotoPane({ src, caption, date }: { src: string; caption: string; date: string }) {
  return (
    <figure className="relative">
      <img src={src} alt="" className="aspect-[3/4] w-full object-cover" />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-baseline justify-between bg-black/70 px-2 py-1">
        <span className="label-cap text-[9px] text-grit">{caption}</span>
        <span className="text-[9px] text-grit-dim">{date.slice(0, 10)}</span>
      </figcaption>
    </figure>
  );
}

/** An empty frame, so the pitch shows the shape of the thing being asked for. */
function PhotoSlot({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <div
      className="grid flex-1 aspect-[3/4] max-h-24 place-items-center rounded-xl border"
      style={{
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? "rgba(255,255,255,.12)" : "rgba(230,50,34,.35)",
        background: dashed ? "transparent" : "rgba(230,50,34,.06)",
      }}
    >
      <span className="label-cap text-[8px] text-grit-dim">{label}</span>
    </div>
  );
}
