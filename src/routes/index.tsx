import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getState, setState, waitForRemoteState } from "@/lib/storage";
import { GritLogo } from "@/components/GritLogo";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount } from "@/lib/account-restore";
import { defaultSchedule } from "@/lib/calc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — Forge Your Body" },
      { name: "description", content: "DEADSET is your no-nonsense gym companion. Train. Build. Become." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { navigate({ to: "/auth", replace: true }); return; }
      await waitForRemoteState(session.user.id);
      if (cancelled) return;
      let s = getState();
      if (!s.profile) {
        const accountProfile = profileFromAccount(await getProfile().catch(() => null));
        if (accountProfile) {
          setState((current) => ({ ...current, profile: accountProfile, schedule: current.schedule ?? defaultSchedule(accountProfile) }));
          s = getState();
        }
      }
      if (s.profile) navigate({ to: "/train", replace: true });
      else navigate({ to: "/onboarding", replace: true });
    })();
    return () => { cancelled = true; };
  }, [getProfile, navigate]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-grit">
      <GritLogo className="text-6xl" />
      <p className="mt-3 label-cap text-grit">Forge Your Body</p>
    </div>
  );
}
