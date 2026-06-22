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

    // Safety valve: never block more than 5s (up from 2s to handle cold starts)
    const safety = setTimeout(finish, 5000);

    async function refreshProfile(uid: string, isBackground = false) {
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

      // Use longer timeout to handle Cloudflare cold starts (up from 4s to 12s)
      const row = await withTimeout(getProfileRef.current().catch(() => null), null, 12000);
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
        // Server confirmed profile is incomplete — redirect to onboarding
        sessionStorage.removeItem(cacheKey);
        cacheProfileBootstrap(uid, {
          onboarded: Boolean(row.onboarded),
          complete: false,
          hasUsername: Boolean(row.username),
        });
        navRef.current({ to: "/onboarding", replace: true });
        return;
      }

      // row is null: fetch timed out or errored. Don't redirect to onboarding
      // unless we have no local profile at all — the user IS logged in.
      logSessionEvent("tabs:profile-fetch-failed", { user: uid.slice(0, 8), isBackground });
      if (getState().profile) {
        setLocalStateOwner(uid);
      } else if (!isBackground) {
        // No local profile AND server failed — retry once before giving up
        logSessionEvent("tabs:profile-fetch-retry", { user: uid.slice(0, 8) });
        const retry = await withTimeout(getProfileRef.current().catch(() => null), null, 12000);
        if (cancelled) return;
        if (retry && profileQuestionsComplete(retry)) {
          sessionStorage.setItem(cacheKey, "onboarded");
          cacheProfileBootstrap(uid, {
            onboarded: Boolean(retry.onboarded),
            complete: true,
            hasUsername: Boolean(retry.username),
          });
          const accountProfile = profileFromAccount(retry);
          if (accountProfile) {
            setState((current) => ({
              ...current,
              profile: accountProfile,
              schedule: current.schedule ?? defaultSchedule(accountProfile),
            }));
            setLocalStateOwner(uid);
          }
        } else if (retry && !profileQuestionsComplete(retry)) {
          navRef.current({ to: "/onboarding", replace: true });
        }
        // If retry also timed out, stay on the page — user is logged in, profile just slow
      }
    }

    (async () => {
      try {
        logSessionEvent("tabs:bootstrap-start");

        // Fast path: trust local cache, render immediately, validate in background.
        const localOwner = getLocalStateOwner();
        if (localOwner && getState().profile) {
          logSessionEvent("tabs:local-fast-path", { user: localOwner.slice(0, 8) });
          finish();
        }

        // Longer session timeout — Supabase getSession() reads localStorage so should
        // be fast, but give extra room for cold start initialization
        const session = await getLoggedSession("tabs:bootstrap", 8000);
        if (cancelled) return;

        if (!session) {
          // Only redirect to auth if we also have no local profile (belt-and-suspenders)
          if (!getState().profile) {
            logSessionEvent("tabs:no-session-redirect-auth");
            navRef.current({ to: "/auth", replace: true });
          }
          finish();
          return;
        }

        const uid = session.user.id;
        if (done) {
          // Already rendered via fast path or safety timer. Refresh in background.
          if (localOwner && localOwner !== uid) setLocalStateOwner(uid);
          void refreshProfile(uid, true);
          return;
        }

        await refreshProfile(uid, false);
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
