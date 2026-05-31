import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { getState, setState, waitForRemoteState } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount } from "@/lib/account-restore";
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      await waitForRemoteState(session.user.id);
      if (cancelled) return;
      let state = getState();
      if (!state.profile) {
        const accountProfile = profileFromAccount(await getProfile().catch(() => null));
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
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth", replace: true });
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
      <Outlet />
      <BottomNav />
    </div>
  );
}
