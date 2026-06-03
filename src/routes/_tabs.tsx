import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { getState, setState, waitForRemoteState } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount, withTimeout } from "@/lib/account-restore";
import { defaultSchedule } from "@/lib/calc";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const [ready, setReady] = useState(false);
  // Keep refs to navigate/getProfile so the bootstrap effect runs ONCE.
  // Unstable refs from useNavigate / useServerFn were causing the effect to
  // re-run, the cleanup to set cancelled=true, and setReady never to fire —
  // leaving the user stuck on a black loading screen after sign-in.
  const navRef = useRef(navigate);
  const getProfileRef = useRef(getProfile);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navRef.current({ to: "/auth", replace: true });
          return;
        }
        await withTimeout(waitForRemoteState(session.user.id), undefined, 2500);
        let state = getState();
        if (!state.profile) {
          const row = await withTimeout(getProfileRef.current().catch(() => null), null, 3000);
          const accountProfile = profileFromAccount(row);
          if (accountProfile) {
            setState((current) => ({
              ...current,
              profile: accountProfile,
              schedule: current.schedule ?? defaultSchedule(accountProfile),
            }));
            state = getState();
          }
        }
        if (!state.profile) {
          navRef.current({ to: "/onboarding", replace: true });
          return;
        }
      } catch (e) {
        console.warn("tabs bootstrap failed", e);
      } finally {
        finish();
      }
    })();

    // Hard safety net: never leave the user on the loading screen for >5s.
    const safety = setTimeout(finish, 5000);

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT" && !s) navRef.current({ to: "/auth", replace: true });
    });
    return () => {
      clearTimeout(safety);
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}
    >
      <TopBar />
      <Outlet />
      <BottomNav />
    </div>
  );
}
