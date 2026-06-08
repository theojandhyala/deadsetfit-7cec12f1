import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { getLocalStateOwner, getState, setState, waitForRemoteState } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount, profileQuestionsComplete, withTimeout } from "@/lib/account-restore";
import { defaultSchedule } from "@/lib/calc";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  // Start ready=true if local state already has a profile — render INSTANTLY
  // on hot refresh / navigation; remote sync continues in the background.
  const [ready, setReady] = useState(false);
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
        const localOwner = getLocalStateOwner();
        // Already rendering? Only trust local app state when it belongs to this signed-in account.
        if (getState().profile && localOwner === session.user.id) return;

        // No local profile: fetch from server fast, in parallel with remote state.
        const [, row] = await Promise.all([
          withTimeout(waitForRemoteState(session.user.id), undefined, 1500),
          withTimeout(getProfileRef.current().catch(() => null), null, 2000),
        ]);
        if (getState().profile && getLocalStateOwner() === session.user.id) return;
        if (!profileQuestionsComplete(row)) {
          navRef.current({ to: "/onboarding", replace: true });
          return;
        }
        if (!getState().profile || localOwner !== session.user.id) {
          const accountProfile = profileFromAccount(row);
          if (accountProfile) {
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
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(70px + env(safe-area-inset-bottom))",
      }}
    >
      <TopBar />
      <Outlet />
      <BottomNav />
    </div>
  );

}
