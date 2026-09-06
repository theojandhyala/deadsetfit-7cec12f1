import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ChartNoAxesCombined, Dumbbell, ShieldCheck } from "lucide-react";
import { Landing } from "@/components/Landing";
import { isNativeIos } from "@/lib/platform";

const NATIVE_SESSION_DEADLINE_MS = 1200;

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
        content: "https://deadsetfit.org/og-image.png",
      },
      {
        name: "twitter:image",
        content: "https://deadsetfit.org/og-image.png",
      },
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
 * returning user never sees the marketing page flash.
 */
function IndexRoute() {
  const navigate = useNavigate();
  const nativeIos = isNativeIos();
  const [sessionResolved, setSessionResolved] = useState(!nativeIos);

  useEffect(() => {
    if (!nativeIos) return;
    let cancelled = false;
    let authSubscription: { unsubscribe: () => void } | undefined;
    (async () => {
      try {
        const { restoreSupabaseSession, supabase } = await import("@/integrations/supabase/client");

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (!cancelled && event === "SIGNED_IN" && session) {
            navigate({ to: "/train", replace: true });
          }
        });
        authSubscription = listener.subscription;

        // The normal path reads Supabase's persistent session locally and
        // resolves almost instantly. Backup recovery may need the network, so
        // let it continue without holding the usable interface for 3+ seconds.
        const session = await Promise.race([
          (async () => {
            const current = await supabase.auth.getSession();
            if (current.data.session) return current.data.session;
            await restoreSupabaseSession();
            return (await supabase.auth.getSession()).data.session;
          })(),
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), NATIVE_SESSION_DEADLINE_MS),
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
      if (!cancelled) setSessionResolved(true);
    })();
    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
    };
  }, [nativeIos, navigate]);

  if (!nativeIos) return <Landing />;
  if (!sessionResolved) return <NativeSessionLoading />;
  return <NativeWelcome />;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`display inline-flex items-baseline font-bold uppercase leading-none ${compact ? "text-2xl" : "text-5xl"}`}
      aria-label="DEADSET"
    >
      <span className="text-[#f4f3ef]">DEAD</span>
      <span className="text-accent-red">SET</span>
    </span>
  );
}

function NativeSessionLoading() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#080808] px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center">
      <div role="status" aria-live="polite">
        <Wordmark />
        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.38em] text-white/55">
          Forge your body
        </p>
        <div className="mx-auto mt-7 h-0.5 w-32 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 animate-[boot-progress_1.15s_ease-in-out_infinite] rounded-full bg-accent-red motion-reduce:w-full motion-reduce:animate-none" />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
          Loading your training
        </p>
      </div>
    </main>
  );
}

const nativeBenefits = [
  { icon: Dumbbell, label: "Log every set" },
  { icon: ChartNoAxesCombined, label: "See real progress" },
  { icon: ShieldCheck, label: "Your data, secured" },
];

function NativeWelcome() {
  return (
    <main className="grid min-h-[100dvh] grid-rows-[auto_1fr_auto] overflow-hidden bg-[#080808] px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] text-[#f4f3ef]">
      <header className="flex min-h-11 items-center justify-between">
        <Wordmark compact />
        <a
          href="/auth/index.html?mode=signin"
          className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-white/75"
        >
          Sign in
        </a>
      </header>

      <section className="flex min-h-0 flex-col items-center justify-center py-4 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-accent-red">
          Built for the lift, not the feed
        </p>
        <h1 className="display mt-4 text-5xl font-bold uppercase leading-[0.9] text-[#f4f3ef]">
          Train like
          <span className="block text-accent-red">it counts.</span>
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
          Build your week, log the work, and know exactly what is improving.
        </p>

        <div
          className="mt-5 grid w-full max-w-md grid-cols-3 gap-2"
          aria-label="What DEADSET tracks"
        >
          {nativeBenefits.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex min-h-[62px] flex-col items-center justify-center gap-2 border-y border-white/10 px-1"
            >
              <Icon size={17} className="text-accent-red" aria-hidden="true" />
              <span className="text-[10px] font-bold leading-tight text-white/65">{label}</span>
            </div>
          ))}
        </div>

        <div className="relative mt-5 h-[min(26dvh,230px)] min-h-[150px] w-[min(72vw,300px)] overflow-hidden rounded-t-[38px] border-x border-t border-white/15 bg-[#151515] p-2 shadow-[0_-12px_45px_rgba(230,50,34,0.12)]">
          <div className="h-full overflow-hidden rounded-t-[30px] bg-black">
            <img
              src="/screenshots/train.webp"
              alt="DEADSET training dashboard"
              width={620}
              height={1347}
              className="h-auto w-full"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <footer className="relative z-10 bg-[#080808] pt-3">
        <a
          href="/auth/index.html?mode=signup"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-accent-red px-6 text-sm font-extrabold uppercase text-white shadow-[0_10px_32px_rgba(230,50,34,0.22)] active:scale-[0.99]"
        >
          Get started free <ArrowRight className="ml-3" size={18} aria-hidden="true" />
        </a>
        <p className="mt-3 text-center text-[10px] leading-4 text-white/40">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-white/65">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-white/65">
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
