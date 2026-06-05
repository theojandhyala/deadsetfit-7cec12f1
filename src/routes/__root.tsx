import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import faviconAsset from "@/assets/deadset-logo.png.asset.json";
import icon16 from "@/assets/icon-16.png.asset.json";
import icon32 from "@/assets/icon-32.png.asset.json";
import icon76 from "@/assets/icon-76.png.asset.json";
import icon120 from "@/assets/icon-120.png.asset.json";
import icon152 from "@/assets/icon-152.png.asset.json";
import icon167 from "@/assets/icon-167.png.asset.json";
import icon180 from "@/assets/icon-180.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StateSync } from "../components/StateSync";
import { UsernameGate } from "../components/UsernameGate";
import { Toaster } from "../components/ui/sonner";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grit-bg px-6">
      <div className="max-w-md text-center">
        <div className="font-display text-[120px] leading-none text-accent-red tracking-tighter">404</div>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-wider text-grit-text">
          Lost in the rack
        </h2>
        <p className="mt-3 text-sm text-grit uppercase tracking-wide">
          This page doesn't exist. Rerack and head back.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-accent-red px-6 py-3 font-display text-sm uppercase tracking-widest text-white transition-colors hover:bg-accent-red/90"
          >
            Back to base
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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-grit-bg px-6">
      <div className="max-w-md text-center">
        <div className="font-display text-5xl uppercase tracking-wider text-accent-red">Failed rep</div>
        <h1 className="mt-3 font-display text-2xl uppercase tracking-wider text-grit-text">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-grit uppercase tracking-wide">
          Something broke on our end. Reset and try again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-accent-red px-5 py-2.5 font-display text-sm uppercase tracking-widest text-white transition-colors hover:bg-accent-red/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-grit-card bg-grit-card px-5 py-2.5 font-display text-sm uppercase tracking-widest text-grit-text transition-colors hover:bg-grit-card/70"
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
      { name: "keywords", content: "gym app, workout tracker, PR tracker, bench press, squat, deadlift, fitness, strength training, lifting log, workout program" },
      { name: "application-name", content: "DEADSET" },
      { name: "apple-mobile-web-app-title", content: "DEADSET" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:site_name", content: "DEADSET" },
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
          logo: "https://deadsetfit.org" + faviconAsset.url,
          description: "DEADSET. Train. Build. Become. A no-nonsense gym companion for tracking PRs, programs, and progress.",
        }),
      },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "16x16", href: icon16.url },
      { rel: "icon", type: "image/png", sizes: "32x32", href: icon32.url },
      { rel: "shortcut icon", type: "image/png", href: faviconAsset.url },
      { rel: "apple-touch-icon", sizes: "76x76", href: icon76.url },
      { rel: "apple-touch-icon", sizes: "120x120", href: icon120.url },
      { rel: "apple-touch-icon", sizes: "152x152", href: icon152.url },
      { rel: "apple-touch-icon", sizes: "167x167", href: icon167.url },
      { rel: "apple-touch-icon", sizes: "180x180", href: icon180.url },
      { rel: "apple-touch-icon", href: icon180.url },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <StateSync />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <UsernameGate />
      <Toaster />
    </QueryClientProvider>
  );
}

