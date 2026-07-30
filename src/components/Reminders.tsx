import { useEffect, useMemo, useState } from "react";
import { X, Bell, Dumbbell, Scale, Apple, Camera, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { usePro } from "@/hooks/usePro";
import { isNativeIos } from "@/lib/platform";

type Reminder = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  cta: string;
};

const DISMISS_KEY = "deadset_reminder_dismiss_v1";

function getDismissed(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}");
  } catch {
    return {};
  }
}
function setDismissed(map: Record<string, string>) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
}

function daysSince(iso?: string): number {
  if (!iso) return Infinity;
  const d = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(d);
}

export function Reminders() {
  const [state] = useAppState();
  const { isPro, loading: proLoading } = usePro();
  const [dismissed, setDismissedState] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Reminder | null>(null);

  useEffect(() => {
    setDismissedState(getDismissed());
  }, []);

  const today = isoDay();

  const items = useMemo(() => {
    const items: Reminder[] = [];

    const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
    const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
    const scheduledExerciseCount =
      activeProgram?.days[todayKey()]?.items.length ??
      schedule?.[todayKey()]?.exerciseIds.length ??
      0;

    // Workout today. Rest days stay quiet.
    if (scheduledExerciseCount > 0 && !state.completedDates.includes(today)) {
      items.push({
        id: "workout-" + today,
        icon: <Dumbbell size={18} />,
        title: "Time to train",
        body: "You haven't logged a workout today. Hit the iron — even 20 minutes counts.",
        to: "/train",
        cta: "Start workout",
      });
    }

    // Weight log (3+ days)
    const lastWeight = state.weights[state.weights.length - 1]?.date;
    const wDays = daysSince(lastWeight);
    if (wDays >= 1) {
      items.push({
        id: "weight-" + today,
        icon: <Scale size={18} />,
        title: wDays === Infinity ? "Log your starting weight" : `Weigh in (${wDays}d ago)`,
        body: "Quick daily weigh-in. It builds the trend that actually tells the truth.",
        to: "/progress",
        cta: "Log weight",
      });
    }

    // Progress picture weekly
    const lastCheckIn = state.checkIns[state.checkIns.length - 1]?.date;
    if (daysSince(lastCheckIn) >= 7) {
      items.push({
        id: "checkin-" + today.slice(0, 7),
        icon: <Camera size={18} />,
        title: "Take a progress picture",
        body: "One photo a week makes progress obvious. Same lighting, same angle, no guessing.",
        to: "/progress",
        cta: "Take photo",
      });
    }

    // Pro: streak armor, head-to-head challenges and full leagues.
    if (!proLoading && !isPro) {
      items.push({
        id: "pro-" + today.slice(0, 7),
        icon: <Crown size={18} />,
        title: "Protect the streak",
        body: "Pro unlocks Streak Armor, head-to-head challenges, full weekly leagues and advanced analytics.",
        to: "/upgrade",
        cta: "Go Pro",
      });
    }

    // Food logging
    const ateToday = state.foodLog?.some((f) => f.date.startsWith(today));
    if (!ateToday) {
      items.push({
        id: "food-" + today,
        icon: <Apple size={18} />,
        title: "Log your meals",
        body: "Barcode, presets or quick manual log. Hitting protein is the difference between bulk and bloat.",
        to: "/diet",
        cta: "Log food",
      });
    }

    return items;
  }, [state, isPro, proLoading, today]);

  // Respect the Settings toggle — reminders off means no cards and no popup.
  const enabled = state.remindersEnabled ?? true;
  const visible = useMemo(
    () => (enabled ? items.filter((r) => dismissed[r.id] !== today) : []),
    [enabled, items, dismissed, today],
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = { ...dismissed, [id]: today };
    setDismissed(next);
    setDismissedState(next);
  }

  return (
    <>
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap text-[9px] flex items-center gap-1.5 text-accent-red">
            <Bell size={11} /> REMINDERS · {visible.length}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 snap-x snap-mandatory">
          {visible.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpen(r)}
              className="snap-start flex-shrink-0 w-[78%] text-left bg-grit-card border border-accent-red/40 p-3 relative hover:border-accent-red transition-colors"
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(r.id);
                }}
                className="absolute top-1.5 right-1.5 p-1 text-grit-dim hover:text-grit cursor-pointer"
                role="button"
                aria-label="Dismiss"
              >
                <X size={12} />
              </span>
              <div className="flex items-center gap-2 text-accent-red">
                {r.icon}
                <p className="label-cap text-[10px] text-grit">{r.title}</p>
              </div>
              <p className="text-[11px] text-grit-dim mt-1 line-clamp-2 pr-4">{r.body}</p>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="bg-grit-card border border-accent-red max-w-md w-full p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(null)}
              className="absolute top-3 right-3 text-grit-dim hover:text-grit"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 text-accent-red mb-2">
              {open.icon}
              <p className="label-cap text-[10px]">REMINDER</p>
            </div>
            <h3 className="display text-2xl font-extrabold uppercase text-grit">{open.title}</h3>
            <p className="text-sm text-grit-dim mt-2">{open.body}</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  dismiss(open.id);
                  setOpen(null);
                }}
                className="btn-ghost flex-1"
              >
                Not now
              </button>
              <Link
                to={open.to}
                onClick={() => {
                  dismiss(open.id);
                  setOpen(null);
                }}
                className="btn-grit flex-1 text-center"
              >
                {open.cta}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
