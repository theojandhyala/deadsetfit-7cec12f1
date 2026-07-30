import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landing } from "@/components/Landing";
import { isNativeIos } from "@/lib/platform";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — A Clearer Way to Train" },
      {
        name: "description",
        content:
          "Plan your week, log every set, and see what is improving. DEADSET brings training, nutrition, health data, and progress into one gym app.",
      },
      { property: "og:title", content: "DEADSET — A Clearer Way to Train" },
      {
        property: "og:description",
        content:
          "Build your schedule, log workouts, track nutrition, and see your progress clearly.",
      },
      { property: "og:url", content: "https://deadsetfit.org/" },
      {
        property: "og:image",
        content:
          "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png",
      },
      {
        name: "twitter:image",
        content:
          "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png",
      },
      { name: "twitter:title", content: "DEADSET — A Clearer Way to Train" },
      {
        name: "twitter:description",
        content:
          "Build your schedule, log workouts, track nutrition, and see your progress clearly.",
      },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/" }],
  }),
  component: IndexRoute,
});

/**
 * A signed-in user opening the app should land on their dashboard, not the
 * marketing page. On web we still render Landing immediately (SEO / first
 * paint) and redirect if a session turns up; on native we briefly hold so a
 * returning user never sees the marketing page flash.
 */
function IndexRoute() {
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(!isNativeIos());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        // A stalled token refresh must never strand native users on the blank
        // boot div — time out and fall through to the landing page instead.
        const {
          data: { session },
        } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 3000),
          ),
        ]);
        if (cancelled) return;
        if (session) {
          navigate({ to: "/train", replace: true });
          return;
        }
      } catch {
        /* fall through to the marketing page */
      }
      if (!cancelled) setShowLanding(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!showLanding) return <div className="min-h-[100dvh] bg-grit" />;
  return <Landing />;
}
