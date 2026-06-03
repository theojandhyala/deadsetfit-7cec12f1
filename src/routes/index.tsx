import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getState, setState, waitForRemoteState } from "@/lib/storage";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount, withTimeout } from "@/lib/account-restore";
import { defaultSchedule } from "@/lib/calc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — Forge Your Body | Gym & PR Tracker" },
      {
        name: "description",
        content:
          "DEADSET is a no-nonsense gym companion. Track bench, squat, deadlift PRs, follow programs, earn Grit, and forge your physique with your squad.",
      },
      { property: "og:title", content: "DEADSET — Forge Your Body" },
      { property: "og:description", content: "Track PRs, follow programs, log workouts. Train. Build. Become." },
      { property: "og:url", content: "https://deadsetfit.org/" },
      { property: "og:image", content: "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png" },
      { name: "twitter:image", content: "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png" },
      { name: "twitter:title", content: "DEADSET — Forge Your Body" },
      { name: "twitter:description", content: "Track PRs, follow programs, log workouts. Train. Build. Become." },
    ],
    links: [
      { rel: "canonical", href: "https://deadsetfit.org/" },
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
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
      );
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      await withTimeout(waitForRemoteState(session.user.id), undefined);
      if (cancelled) return;
      let s = getState();
      if (!s.profile) {
        const accountProfile = profileFromAccount(await getProfile().catch(() => null));
        if (accountProfile) {
          setState((current) => ({
            ...current,
            profile: accountProfile,
            schedule: current.schedule ?? defaultSchedule(accountProfile),
          }));
          s = getState();
        }
      }
      if (s.profile) navigate({ to: "/train", replace: true });
      else navigate({ to: "/onboarding", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [getProfile, navigate]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-grit">
      <span className="display font-extrabold tracking-wider text-6xl" style={{ fontStyle: "italic" }}>
        <span style={{ color: "#f5f5f0" }}>DEAD</span>
        <span style={{ color: "#e63222" }}>SET</span>
      </span>
      <p className="mt-3 label-cap text-grit">Forge Your Body</p>
    </div>
  );
}
