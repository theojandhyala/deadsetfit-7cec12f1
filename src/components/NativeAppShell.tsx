import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { CelebrationLayer } from "./CelebrationLayer";
import { ConfirmSheet } from "./ConfirmSheet";
import { CrewInviteRedeemer } from "./CrewInviteRedeemer";
import { PaywallSheet } from "./PaywallSheet";
import { ReferralRedeemer } from "./ReferralRedeemer";
import { RevenueCatSync } from "./RevenueCatSync";
import { StateSync } from "./StateSync";
import { Toaster } from "./ui/sonner";
import { UsernameGate } from "./UsernameGate";
import { ProProvider } from "../hooks/usePro";

const DeferredAppLayers = lazy(() =>
  import("./DeferredAppLayers").then((module) => ({ default: module.DeferredAppLayers })),
);

function useIdleLayers(enabled: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const reveal = () => setReady(true);
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(reveal, { timeout: 800 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = globalThis.setTimeout(reveal, 180);
    return () => globalThis.clearTimeout(id);
  }, [enabled]);

  return ready;
}

/** The authenticated native shell; intentionally absent from first download. */
export function NativeAppShell({
  queryClient,
  isAuthRoute,
  children,
}: {
  queryClient: QueryClient;
  isAuthRoute: boolean;
  children: ReactNode;
}) {
  const idleLayersReady = useIdleLayers(!isAuthRoute);

  return (
    <QueryClientProvider client={queryClient}>
      <ProProvider>
        <RevenueCatSync />
        {!isAuthRoute ? <StateSync /> : null}
        {children}
        {!isAuthRoute ? <UsernameGate /> : null}
        {!isAuthRoute ? <PaywallSheet /> : null}
        {!isAuthRoute ? <CelebrationLayer /> : null}
        {!isAuthRoute && idleLayersReady ? (
          <Suspense fallback={null}>
            <DeferredAppLayers />
          </Suspense>
        ) : null}
        <ReferralRedeemer />
        <CrewInviteRedeemer />
        <ConfirmSheet />
        <Toaster />
      </ProProvider>
    </QueryClientProvider>
  );
}
