import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Landing } from "@/components/Landing";
import { GritLogo } from "@/components/GritLogo";
import { NativeWelcome } from "@/components/NativeWelcome";
import { isNativeApp } from "@/lib/platform";

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
      { property: "og:image", content: "https://deadsetfit.org/og-image.png" },
      { name: "twitter:image", content: "https://deadsetfit.org/og-image.png" },
      { name: "apple-itunes-app", content: "app-id=6783511541" },
      { name: "twitter:title", content: "DEADSET — A Clearer Way to Train" },
      {
        name: "twitter:description",
        content:
          "Build your schedule, log workouts, track nutrition, and see your progress clearly.",
      },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          name: "DEADSET",
          operatingSystem: "iOS",
          applicationCategory: "HealthApplication",
          description:
            "Plan workouts, log every set, track nutrition and recovery, and see strength progress clearly.",
          downloadUrl: "https://apps.apple.com/app/deadset/id6783511541",
          offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
        }),
      },
    ],
  }),
  component: IndexRoute,
});

/**
 * A signed-in user opening the app should land on their dashboard, not the
 * marketing page. On web we still render Landing immediately (SEO / first
 * paint) and redirect if a session turns up; on native we briefly hold so a
 * returning user never sees the welcome screen flash.
 */
function IndexRoute() {
  const navigate = useNavigate();
  const [native] = useState(() => isNativeApp());
  const [entryReady, setEntryReady] = useState(!native);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!cancelled && session) navigate({ to: "/train", replace: true });
        });
        unsubscribe = () => authListener.subscription.unsubscribe();
        if (cancelled) {
          unsubscribe();
          return;
        }

        // A stalled token refresh must never strand native users on a blank
        // boot view. The listener still catches a valid session restored later.
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
        /* Fall through to the correct platform entry screen. */
      }
      if (!cancelled) setEntryReady(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [navigate]);

  if (!entryReady) return <NativeSessionLoading />;
  if (native) return <NativeWelcome />;
  return <Landing />;
}

/** Keeps the branded launch experience continuous while the saved session is restored. */
function NativeSessionLoading() {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(120%_90%_at_50%_0%,#1a0b0b_0%,#0a0a0a_55%)] px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <GritLogo className="inline-block animate-pulse text-[46px]" />
        <p className="label-cap mt-4 text-[9px] text-white/55">Loading your training</p>
        <div
          className="mx-auto mt-6 h-0.5 w-32 overflow-hidden rounded-full bg-white/10"
          aria-hidden="true"
        >
          <span className="block h-full w-2/5 animate-pulse rounded-full bg-accent-red" />
        </div>
      </div>
    </main>
  );
}
