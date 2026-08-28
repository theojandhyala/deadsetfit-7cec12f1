import { useEffect, useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { useAppState, getHydrationCount } from "@/lib/storage";
import { achievements, RARITY_COLOR, unlockedIds, type Achievement } from "@/lib/achievements";
import { headlineUnlock, newlyUnlocked } from "@/lib/achievement-unlocks";
import { BadgeShareCard } from "@/components/BadgeShareCard";
import { useUnit } from "@/hooks/useUnit";

const SEEN_KEY = "deadset_badges_seen";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* a full quota must never block training */
  }
}

/**
 * Celebrates a badge the moment it is earned, and offers to post it.
 *
 * Badges already earned before this ever ran are recorded silently, exactly
 * like the streak watcher does — nobody wants twenty modals because their
 * history just synced.
 */
export function AchievementWatcher() {
  const [state] = useAppState();
  const [hit, setHit] = useState<Achievement | null>(null);
  const [sharing, setSharing] = useState<Achievement | null>(null);
  const initialised = useRef(false);
  const lastHydration = useRef(getHydrationCount());

  const unit = useUnit();
  const all = useMemo(() => achievements(state), [state]);
  const unlocked = useMemo(() => unlockedIds(all), [all]);
  const unlockedKey = unlocked.join(",");

  useEffect(() => {
    const seen = readSeen();
    // A remote hydration means history arrived, not a live unlock — record it
    // silently, the same as first observation.
    const hydration = getHydrationCount();
    const hydrated = hydration !== lastHydration.current;
    lastHydration.current = hydration;
    const first = !initialised.current || hydrated;
    initialised.current = true;

    const fresh = newlyUnlocked(unlocked, seen);
    if (!fresh.length) return;
    writeSeen(unlocked);
    if (first) return;
    const headline = headlineUnlock(fresh, unit);
    if (headline) setHit(headline);
  }, [unlockedKey, unlocked, unit]);

  if (sharing) {
    return (
      <BadgeShareCard
        badge={sharing}
        displayName={state.profile?.displayName || state.profile?.username || undefined}
        username={state.profile?.username}
        unlockedCount={unlocked.length}
        totalCount={all.length}
        onClose={() => setSharing(null)}
      />
    );
  }

  if (!hit) return null;
  const accent = RARITY_COLOR[hit.rarity];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{ background: "rgba(8,4,2,0.84)" }}
      role="dialog"
      aria-modal="true"
      onClick={() => setHit(null)}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl p-6 text-center"
        style={{
          background: "linear-gradient(160deg, #1b1418 0%, #140d0d 45%, #0d0605 100%)",
          border: `1px solid ${accent}`,
          boxShadow: `0 18px 48px rgba(0,0,0,.45), 0 0 34px ${accent}44`,
          animation: "pro-pop 0.5s cubic-bezier(.2,.9,.3,1.2) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,220,180,0.28), transparent)",
            animation: "pro-sweep 1.6s ease-in-out 0.35s both",
          }}
        />
        <div
          className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${accent}55, transparent 70%)`,
            border: `2px solid ${accent}`,
          }}
        >
          {hit.icon}
        </div>
        <p className="label-cap text-[10px] tracking-[0.28em]" style={{ color: accent }}>
          Badge unlocked · {hit.rarity}
        </p>
        <h2 className="display mt-1 text-3xl font-extrabold uppercase leading-none text-grit">
          {hit.label}
        </h2>
        <p className="mt-3 mb-5 text-xs text-[#b7a9a4]">{hit.desc}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setHit(null)} className="btn-ghost min-h-[48px] rounded-xl">
            Nice
          </button>
          <button
            onClick={() => {
              setSharing(hit);
              setHit(null);
            }}
            className="btn-grit flex min-h-[48px] items-center justify-center gap-2 rounded-xl"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
