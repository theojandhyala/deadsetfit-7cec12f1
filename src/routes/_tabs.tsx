import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSession() is a local localStorage read — don't time it out.
      // Timing it out and falling back to null was bouncing signed-in users
      // back to /auth on slow page loads.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      await withTimeout(waitForRemoteState(session.user.id), undefined);
      if (cancelled) return;
      let state = getState();
      if (!state.profile) {
        const accountProfile = profileFromAccount(await withTimeout(getProfile().catch(() => null), null));
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
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      setReady(true);
    })();
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // Only kick to /auth on an EXPLICIT sign-out. INITIAL_SESSION can fire
      // with session=null briefly on hard refresh before localStorage hydrates,
      // which would otherwise bounce a signed-in user back to the login screen.
      if (event === "SIGNED_OUT" && !s) navigate({ to: "/auth", replace: true });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [getProfile, navigate]);
  if (!ready) return <div className="min-h-screen bg-grit" />;
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
