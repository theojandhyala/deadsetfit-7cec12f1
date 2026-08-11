import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { GritEarnedLayer } from "@/components/GritEarnedLayer";
import { FirstRunTour } from "@/components/FirstRunTour";
import { TopBar } from "@/components/TopBar";
import {
  getLocalStateOwner,
  getState,
  setLocalStateOwner,
  setState,
  useAppState,
  waitForRemoteState,
} from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { restoreSupabaseSession } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount, profileQuestionsComplete, withTimeout } from "@/lib/account-restore";
import { calculateGritScore, calculateStreak, defaultSchedule } from "@/lib/calc";
import { emitGritEarned } from "@/lib/grit-events";
import { getRank } from "@/lib/rank";
import { runStreakArmor } from "@/lib/streak-armor";
import { importHealthWorkouts, healthSupported } from "@/lib/health";
import { usePro } from "@/hooks/usePro";
import { FeatureTour } from "@/components/FeatureTour";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  const navigate = useNavigate();
  const getProfile = getMyProfile;
  const [state, set] = useAppState();
  const { isPro, loading: proLoading } = usePro();
  // Start ready=true if local state already has a profile — render INSTANTLY
  // on hot refresh / navigation; remote sync continues in the background.
  const [ready, setReady] = useState(false);
  const navRef = useRef(navigate);
  const getProfileRef = useRef(getProfile);
  const lastScoreRef = useRef<number | null>(null);
  const lastRankRef = useRef<string | null>(null);
  navRef.current = navigate;
  getProfileRef.current = getProfile;

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    (async () => {
      try {
        await withTimeout(restoreSupabaseSession(), undefined, 2500);
        let {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          { data: { session: null }, error: null },
          3500,
        );
        if (!session) {
          const refreshed = await withTimeout(
            supabase.auth.refreshSession(),
            { data: { session: null, user: null }, error: null },
            3500,
          );
          session = refreshed.data.session;
        }
        if (!session) {
          // If the browser has valid local app state, keep the app usable during
          // a transient Supabase/storage refresh failure instead of bouncing the
          // user to auth and making it look like they were logged out.
          if (getState().profile) return;
          navRef.current({ to: "/auth", replace: true });
          return;
        }
        const localOwner = getLocalStateOwner();
        // Already rendering? Only trust local app state when it belongs to this signed-in account.
        if (getState().profile && localOwner === session.user.id) return;

        // No local profile: fetch from server fast, in parallel with remote state.
        const [, row] = await Promise.all([
          withTimeout(waitForRemoteState(session.user.id), undefined, 1500),
          withTimeout(
            getProfileRef.current().catch(() => null),
            null,
            2000,
          ),
        ]);
        if (getState().profile && getLocalStateOwner() === session.user.id) return;
        if (!profileQuestionsComplete(row)) {
          navRef.current({ to: "/onboarding", replace: true });
          return;
        }
        if (!getState().profile || localOwner !== session.user.id) {
          const accountProfile = profileFromAccount(row);
          if (accountProfile) {
            setLocalStateOwner(session.user.id);
            setState((current) => ({
              ...current,
              profile: accountProfile,
              schedule: current.schedule ?? defaultSchedule(accountProfile),
            }));
          }
        }
        if (!getState().profile) {
          navRef.current({ to: "/onboarding", replace: true });
          return;
        }
      } catch (e) {
        console.warn("tabs bootstrap failed", e);
      } finally {
        finish();
      }
    })();

    const safety = setTimeout(finish, 3000);

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && s) finish();
    });
    return () => {
      clearTimeout(safety);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready || !state.profile) return;
    const score = calculateGritScore(state).total;
    const rank = getRank(score);
    const previous = lastScoreRef.current;
    const previousRank = lastRankRef.current;
    lastScoreRef.current = score;
    lastRankRef.current = rank.label;
    if (previous == null) return;
    const gain = score - previous;
    if (gain <= 0) return;
    // A jump this size is a remote hydrate landing, not something the user
    // just did — re-baseline silently instead of celebrating phantom grit.
    if (gain > 100) return;
    const promoted = !!previousRank && previousRank !== rank.label;
    emitGritEarned(
      gain,
      promoted ? rank.label : "GRIT EARNED",
      promoted ? "rank" : "grit",
      promoted ? { rankPoints: score, previousRankLabel: previousRank } : undefined,
    );
  }, [ready, state]);

  // Streak Armor: monthly shield refill + auto-rescue of a missed day (Pro).
  // Waits for remote hydration first — a laptop with a stale cached blob must
  // not burn a shield rescuing a day the athlete actually trained on their
  // phone two seconds before the sync lands.
  useEffect(() => {
    if (!ready || proLoading || !isPro || !state.profile) return;
    let disposed = false;
    (async () => {
      const {
        data: { session },
      } = await withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null });
      const uid = session?.user?.id;
      if (uid) await waitForRemoteState(uid);
      if (disposed) return;
      const result = runStreakArmor(getState(), isPro);
      if (!result) return;
      set(() => result.next);
      if (result.consumedDate) {
        emitGritEarned(calculateStreak(result.next.completedDates), "STREAK ARMOR USED", "streak");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [ready, proLoading, isPro, state.profile, set, state.completedDates]);

  // Apple Watch / Health import — native iOS only, once per app open.
  const healthImportedRef = useRef(false);
  useEffect(() => {
    if (!ready || !state.profile || healthImportedRef.current || !healthSupported()) return;
    if (!state.healthSync?.enabled || !state.healthSync.importWorkouts) return;
    healthImportedRef.current = true;
    importHealthWorkouts(getState()).then((next) => {
      if (next) set(() => next);
    });
  }, [ready, state.profile, state.healthSync?.enabled, state.healthSync?.importWorkouts, set]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-grit flex items-center justify-center">
        <span className="label-cap text-grit-dim text-xs animate-pulse">Loading…</span>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen bg-grit"
      style={{
        paddingTop: "calc(92px + env(safe-area-inset-top))",
        paddingBottom: "calc(104px + env(safe-area-inset-bottom))",
      }}
    >
      <TopBar />
      <Outlet />
      <FeatureTour />
      <GritEarnedLayer />
      <FirstRunTour active={!!state.profile} />
      <BottomNav />
    </div>
  );
}
