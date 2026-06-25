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
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StateSync } from "../components/StateSync";
import { UsernameGate } from "../components/UsernameGate";
import { Toaster } from "../components/ui/sonner";
import { PaywallProvider } from "../hooks/usePro";
import { PaywallSheet } from "../components/PaywallSheet";

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
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
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
          logo: "https://deadsetfit.org/favicon.ico",
          description:
            "DEADSET. Train. Build. Become. A no-nonsense gym companion for tracking PRs, programs, and progress.",
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/__l5e/assets-v1/8b3ee421-1183-47fa-b08c-2852d1ee9386/apple-touch-icon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/__l5e/assets-v1/3c85945d-aaa0-42df-9b92-790c5443f062/apple-touch-icon-16x16.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/__l5e/assets-v1/8b0e02d2-2d9f-4268-b20c-cf4bf9b3a7b0/apple-touch-icon-180x180.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "167x167",
        href: "/__l5e/assets-v1/b709d3b5-25fb-49bc-a497-ce39436e1d13/apple-touch-icon-167x167.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "152x152",
        href: "/__l5e/assets-v1/3cba76de-9499-4239-ae4f-9c38911c8a13/apple-touch-icon-152x152.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "120x120",
        href: "/__l5e/assets-v1/6673b37c-9b6f-4a9a-9f1b-d3c13c9d2f33/apple-touch-icon-120x120.png",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/__l5e/assets-v1/4c99f39e-a2aa-4107-a481-4d1c5b8b37b0/splash-2732.png",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap",
      },

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
      <PaywallProvider>
        <StateSync />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <UsernameGate />
        <PaywallSheet />
        <Toaster />
      </PaywallProvider>
    </QueryClientProvider>
  );
}
