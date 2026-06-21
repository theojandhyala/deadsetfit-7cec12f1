import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import {
  getLocalStateOwner,
  getState,
  setLocalStateOwner,
  setState,
} from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { profileFromAccount, profileQuestionsComplete, withTimeout } from "@/lib/account-restore";
import { defaultSchedule } from "@/lib/calc";
import {
  cacheProfileBootstrap,
  getCachedProfileBootstrap,
  getLoggedSession,
  logSessionEvent,
} from "@/lib/session-diagnostics";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center px-6 pt-20 gap-4 text-center">
          <p className="label-cap text-accent-red">Something went wrong</p>
          <p className="text-xs text-grit-dim">
            {(this.state.error as Error).message ?? "Unexpected error"}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="btn-grit px-6 py-3 label-cap"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabsLayout() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const [ready, setReady] = useState(false);
  const navRef = useRef(navigate);
  const getProfileRef = useRef(getProfile);
  navRef.current = navigate;
  getProfileRef.current = getProfile;

  useEffect(() => {
    let cancelled = false;
    let done = false;
    const finish = () => {
      if (done || cancelled) return;
      done = true;
      setReady(true);
    };

    // Hard safety: never block the UI more than 2s. Background work continues.
    const safety = setTimeout(finish, 2000);

    async function refreshProfile(uid: string) {
      const cacheKey = `ds_profile_status_${uid}`;
      const cachedBootstrap = getCachedProfileBootstrap(uid);
      if (
        (sessionStorage.getItem(cacheKey) === "onboarded" || cachedBootstrap?.complete) &&
        getState().profile
      ) {
        setLocalStateOwner(uid);
        return;
      }
      logSessionEvent("tabs:profile-fetch-start", { user: uid.slice(0, 8) });
      const row = await withTimeout(getProfileRef.current().catch(() => null), null, 4000);
      if (cancelled) return;

      if (row && profileQuestionsComplete(row)) {
        sessionStorage.setItem(cacheKey, "onboarded");
        cacheProfileBootstrap(uid, {
          onboarded: Boolean(row.onboarded),
          complete: true,
          hasUsername: Boolean(row.username),
        });
        const accountProfile = profileFromAccount(row);
        if (accountProfile) {
          setState((current) => ({
            ...current,
            profile: accountProfile,
            schedule: current.schedule ?? defaultSchedule(accountProfile),
          }));
          setLocalStateOwner(uid);
        }
        return;
      }

      if (row && !profileQuestionsComplete(row)) {
        sessionStorage.removeItem(cacheKey);
        cacheProfileBootstrap(uid, {
          onboarded: Boolean(row.onboarded),
          complete: false,
          hasUsername: Boolean(row.username),
        });
        navRef.current({ to: "/onboarding", replace: true });
        return;
      }

      // Fetch failed/timed out. Keep local profile if any.
      if (getState().profile) {
        setLocalStateOwner(uid);
      } else {
        navRef.current({ to: "/onboarding", replace: true });
      }
    }

    (async () => {
      try {
        logSessionEvent("tabs:bootstrap-start");

        // Fast path: trust local cache, render immediately, validate in bg.
        const localOwner = getLocalStateOwner();
        if (localOwner && getState().profile) {
          logSessionEvent("tabs:local-fast-path", { user: localOwner.slice(0, 8) });
          finish();
        }

        const session = await getLoggedSession("tabs:bootstrap", 1800);
        if (cancelled) return;

        if (!session) {
          logSessionEvent("tabs:no-session-redirect-auth");
          navRef.current({ to: "/auth", replace: true });
          finish();
          return;
        }

        const uid = session.user.id;
        if (done) {
          // Already rendered. Refresh in background.
          if (localOwner && localOwner !== uid) setLocalStateOwner(uid);
          void refreshProfile(uid);
          return;
        }

        await refreshProfile(uid);
        finish();
      } catch (e) {
        logSessionEvent("tabs:bootstrap-error", {
          message: e instanceof Error ? e.message : "Unknown",
        });
        console.warn("tabs bootstrap failed", e);
        finish();
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT" && !s) navRef.current({ to: "/auth", replace: true });
    });
    return () => {
      cancelled = true;
      clearTimeout(safety);
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-grit flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
        <span className="label-cap text-grit text-xs">Loading your profile…</span>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen bg-grit"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 56px)",
        paddingBottom: "calc(76px + env(safe-area-inset-bottom))",
      }}
    >
      <TopBar />
      <PageErrorBoundary>
        <Outlet />
      </PageErrorBoundary>
      <BottomNav />
    </div>
  );
}
