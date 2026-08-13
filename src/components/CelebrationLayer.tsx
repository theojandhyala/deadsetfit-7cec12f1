import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Share2 } from "lucide-react";
import { onGritEarned, type GritAnimationEvent, type PRShareDetails } from "@/lib/grit-events";
import { maybeNudge } from "@/lib/upgrade-prompts";
import { RankEmblem } from "@/components/RankEmblem";
import { PRShareCard } from "@/components/PRShareCard";
import { useAppState } from "@/lib/storage";

/**
 * Full-screen takeover for the moments that deserve more than a toast:
 * PR detections and rank-ups. Complements GritEarnedLayer (small bursts).
 * Auto-dismisses; tap skips.
 *
 * A PR that carries share details holds longer and offers a share card — the
 * lift is at its most postable in the seconds right after it lands.
 */
export function CelebrationLayer() {
  const [state] = useAppState();
  const [event, setEvent] = useState<GritAnimationEvent | null>(null);
  const [sharePr, setSharePr] = useState<PRShareDetails | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The nudge fires on a delay; it must not stack on top of the share card.
  const sharingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    timer.current = null;
    nudgeTimer.current = null;
  }, []);

  useEffect(
    () =>
      onGritEarned((e) => {
        if (e.kind !== "pr" && e.kind !== "rank") return;
        setEvent(e);
        clearTimers();
        const hold = e.kind === "rank" ? 3600 : e.pr ? 6000 : 2200;
        timer.current = setTimeout(() => setEvent(null), hold);
        // High-intent moment: after the celebration, a capped Pro nudge can ride along.
        if (e.kind === "pr") {
          nudgeTimer.current = setTimeout(
            () => {
              if (!sharingRef.current) maybeNudge("pr");
            },
            e.pr ? 6200 : 2400,
          );
        }
      }),
    [clearTimers],
  );
  useEffect(() => () => clearTimers(), [clearTimers]);

  function openShare(pr: PRShareDetails) {
    sharingRef.current = true;
    clearTimers();
    setSharePr(pr);
    setEvent(null);
  }

  function closeShare() {
    sharingRef.current = false;
    setSharePr(null);
  }

  if (sharePr) {
    const profile = state.profile;
    return (
      <PRShareCard
        pr={sharePr}
        displayName={profile?.displayName || profile?.username || "Athlete"}
        username={profile?.username}
        onClose={closeShare}
      />
    );
  }

  if (!event) return null;
  const isRank = event.kind === "rank";
  const pr = event.pr;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center"
      // No backdrop-filter: composites as solid black while scrolling in WKWebView/iOS Safari.
      style={{ background: "rgba(5,5,5,0.92)" }}
    >
      {/* Tap anywhere to skip — behind the content so the share button stays clickable. */}
      <button
        type="button"
        aria-label="Dismiss celebration"
        onClick={() => setEvent(null)}
        className="absolute inset-0 cursor-default"
      />
      <span
        className="celebrate-flash pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 45%, rgba(230,50,34,0.35), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <span
        className="celebrate-wave pointer-events-none absolute h-40 w-40 rounded-full border-2 border-accent-red/60"
        aria-hidden="true"
      />
      <span
        className="celebrate-wave-late pointer-events-none absolute h-40 w-40 rounded-full border border-accent-red/40"
        aria-hidden="true"
      />
      {isRank && (
        <span className="rank-ceremony-rays pointer-events-none absolute h-[70vmin] w-[70vmin]" />
      )}
      <div className="celebrate-overlay pointer-events-none relative flex flex-col items-center px-8 text-center">
        {isRank && event.rankPoints != null ? (
          <span className="rank-ceremony-emblem">
            <RankEmblem
              gritPoints={event.rankPoints}
              size="xl"
              showProgress={false}
              showLabel={false}
            />
          </span>
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-red text-white shadow-[0_0_60px_rgba(230,50,34,0.8)]">
            <Flame size={40} strokeWidth={2.5} />
          </span>
        )}
        <span className="label-cap mt-5 text-[11px] text-accent-red">
          {isRank ? "RANK PROMOTION" : "NEW PERSONAL RECORD"}
        </span>
        <span className="display mt-1 text-4xl font-black uppercase leading-tight text-grit">
          {event.label && event.label !== "GRIT EARNED"
            ? event.label.replace(/^NEW PR — /, "")
            : isRank
              ? "You promoted"
              : "PR locked"}
        </span>
        {isRank ? (
          <span className="mt-3 text-xs font-semibold uppercase text-grit-dim">
            {event.previousRankLabel ? `${event.previousRankLabel} → ` : ""}
            <span className="text-grit">New division secured</span>
          </span>
        ) : (
          <span className="display mt-2 text-xl font-black text-accent-red">
            +{event.amount} GRIT
          </span>
        )}
        {pr && (
          <button
            type="button"
            onClick={() => openShare(pr)}
            className="pointer-events-auto mt-7 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-accent-red px-7 text-sm font-extrabold uppercase tracking-widest text-white shadow-[0_0_40px_rgba(230,50,34,0.45)]"
          >
            <Share2 size={17} />
            Share this PR
          </button>
        )}
      </div>
    </div>
  );
}
