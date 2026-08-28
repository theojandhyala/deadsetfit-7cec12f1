import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Landing } from "@/components/Landing";
import { NativeWelcome } from "@/components/NativeWelcome";
import { finishAppBoot } from "@/lib/app-boot";
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
          offers: { "@type": "Offer", price: "5.99", priceCurrency: "GBP" },
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
        const { restoreSupabaseSession, supabase } = await import("@/integrations/supabase/client");
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!cancelled && session) navigate({ to: "/train", replace: true });
        });
        unsubscribe = () => authListener.subscription.unsubscribe();
        if (cancelled) {
          unsubscribe();
          return;
        }

        // Keep the branded launch layer up while the persisted session and its
        // cookie backup are genuinely resolved. A retry appears on the launch
        // layer if this stalls; we never reveal a false signed-out screen.
        await restoreSupabaseSession();
        const {
          data: { session },
        } = await supabase.auth.getSession();
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

  useEffect(() => {
    if (entryReady) finishAppBoot();
  }, [entryReady]);

  if (!entryReady) return <NativeSessionLoading />;
  if (native) return <NativeWelcome />;
  return <Landing />;
}

/** Keeps the branded launch experience continuous while the saved session is restored. */
function NativeSessionLoading() {
  return <main className="min-h-[100dvh] bg-[#080808]" aria-hidden="true" />;
}
