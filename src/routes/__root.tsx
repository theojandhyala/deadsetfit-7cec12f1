import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { StateSync } from "../components/StateSync";
import { UsernameGate } from "../components/UsernameGate";
import { PaywallSheet } from "../components/PaywallSheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { CelebrationLayer } from "../components/CelebrationLayer";
import { Toaster } from "../components/ui/sonner";
import { ProProvider } from "../hooks/usePro";
import { ProWelcome } from "../components/ProWelcome";
import { UpgradeNudge } from "../components/UpgradeNudge";
import { ReferralRedeemer } from "../components/ReferralRedeemer";
import { CrewInviteRedeemer } from "../components/CrewInviteRedeemer";
import { StreakMilestoneWatcher } from "../components/StreakMilestoneWatcher";
import { AchievementWatcher } from "../components/AchievementWatcher";
import { TonnageMilestoneWatcher } from "../components/TonnageMilestoneWatcher";
import { captureAttribution } from "../lib/attribution";
import { capturePendingCrew } from "../lib/crew-invite";
import { WeeklyRecapNudge } from "../components/WeeklyRecapNudge";
import { DeviceReminderSync } from "../components/DeviceReminderSync";
import { RevenueCatSync } from "../components/RevenueCatSync";
import { AppReviewWatcher } from "../components/AppReviewWatcher";
import { FirstWeekActivationNudge } from "../components/FirstWeekActivationNudge";
import { FeedbackPulse } from "../components/FeedbackPulse";
import { isNativeIos } from "../lib/platform";
import { WhopConsentBanner } from "../components/WhopConsent";
import { finishAppBoot } from "../lib/app-boot";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="display text-3xl font-extrabold uppercase tracking-wide text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          DEADSET hit a loading error. Your profile and workouts are saved to your account, so try
          again safely.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Refresh
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "DEADSET" },
      {
        name: "keywords",
        content:
          "gym app, workout tracker, PR tracker, bench press, squat, deadlift, fitness, strength training, lifting log, workout program",
      },
      { name: "application-name", content: "DEADSET" },
      { property: "og:site_name", content: "DEADSET" },
      // Mirrors index.html so a link shared from any in-app route unfurls with
      // the real card rather than the touch icon.
      { property: "og:image", content: "https://deadsetfit.org/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://deadsetfit.org/og-image.png" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "DEADSET",
          url: "https://deadsetfit.org",
          logo: "https://deadsetfit.org/favicon.ico",
          description:
            "DEADSET is a gym app for planning workouts, logging sets, tracking nutrition, and understanding progress.",
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Client-only app: index.html owns <html>/<head>/<body>. Rendering another
  // document shell inside #root creates nested <html> elements — invalid DOM
  // that sends React's event dispatch into an infinite loop (frozen app,
  // black screen while scrolling). HeadContent tags are hoisted to the real
  // <head> by React 19.
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  const nativeIos = isNativeIos();
  const setupPreview =
    import.meta.env.DEV &&
    pathname === "/onboarding" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const isPublicWebsiteRoute = [
    "/",
    "/privacy",
    "/terms",
    "/disclaimer",
    "/tiktok",
    "/creator",
    "/3-day-gym-plan",
    "/workout-tracker",
    "/stop-guessing",
    "/real-week",
  ].includes(pathname);

  // Record where this visitor came from (referrer/UTM) for admin analytics.
  useEffect(() => {
    if (!isAuthRoute) captureAttribution();
    capturePendingCrew();
  }, [isAuthRoute]);

  useEffect(() => {
    if (!nativeIos && isPublicWebsiteRoute) finishAppBoot();
  }, [isPublicWebsiteRoute, nativeIos]);

  if (!nativeIos && !setupPreview) {
    return (
      <QueryClientProvider client={queryClient}>
        {isPublicWebsiteRoute ? <Outlet /> : <WebMarketingRedirect />}
        <WhopConsentBanner />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ProProvider>
        <RevenueCatSync />
        {!isAuthRoute && <StateSync />}
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        {!isAuthRoute && <UsernameGate />}
        {!isAuthRoute && <PaywallSheet />}
        {!isAuthRoute && <CelebrationLayer />}
        {!isAuthRoute && <ProWelcome />}
        {!isAuthRoute && <UpgradeNudge />}
        {!isAuthRoute && <StreakMilestoneWatcher />}
        {!isAuthRoute && <AchievementWatcher />}
        {!isAuthRoute && <TonnageMilestoneWatcher />}
        {!isAuthRoute && <WeeklyRecapNudge />}
        {!isAuthRoute && <FirstWeekActivationNudge />}
        {!isAuthRoute && <FeedbackPulse />}
        {!isAuthRoute && <DeviceReminderSync />}
        {!isAuthRoute && <AppReviewWatcher />}
        <ReferralRedeemer />
        <CrewInviteRedeemer />
        <ConfirmSheet />
        <Toaster />
      </ProProvider>
    </QueryClientProvider>
  );
}

function WebMarketingRedirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#080808] px-6 text-center text-white">
      <div>
        <p className="display text-4xl font-bold uppercase">
          DEAD<span className="text-accent-red">SET</span>
        </p>
        <p className="mt-3 text-sm text-white/50">Opening the DEADSET website…</p>
        <a href="/" className="mt-6 inline-flex min-h-11 items-center font-bold text-white">
          Continue
        </a>
      </div>
    </main>
  );
}
