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
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    (async () => {
      try {
        logSessionEvent("tabs:bootstrap-start");
        const session = await getLoggedSession("tabs:bootstrap", 3000);
        if (!session) {
          logSessionEvent("tabs:no-session-redirect-auth");
          navRef.current({ to: "/auth", replace: true });
          return;
        }
        const uid = session.user.id;
        const cacheKey = `ds_profile_status_${uid}`;
        const cachedBootstrap = getCachedProfileBootstrap(uid);

        // Fast path: local profile already belongs to this user — render immediately.
        if (getState().profile && getLocalStateOwner() === uid) {
          logSessionEvent("tabs:local-profile-ready", { user: uid.slice(0, 8) });
          return;
        }

        // Second-best path: we've already seen this user onboarded in this tab,
        // and have a local profile — render immediately and let StateSync hydrate.
        if (
          (sessionStorage.getItem(cacheKey) === "onboarded" || cachedBootstrap?.complete) &&
          getState().profile
        ) {
          setLocalStateOwner(uid);
          logSessionEvent("tabs:cached-profile-ready", { user: uid.slice(0, 8) });
          return;
        }

        logSessionEvent("tabs:profile-fetch-start", { user: uid.slice(0, 8) });
        const row = await withTimeout(getProfileRef.current().catch(() => null), null, 5000);

        if (getState().profile && getLocalStateOwner() === uid) {
          logSessionEvent("tabs:state-sync-profile-ready", { user: uid.slice(0, 8) });
          return;
        }

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
          logSessionEvent("tabs:profile-loaded", { user: uid.slice(0, 8) });
          return;
        }

        if (row && !profileQuestionsComplete(row)) {
          sessionStorage.removeItem(cacheKey);
          cacheProfileBootstrap(uid, {
            onboarded: Boolean(row.onboarded),
            complete: false,
            hasUsername: Boolean(row.username),
          });
          logSessionEvent("tabs:profile-incomplete-redirect-onboarding", { user: uid.slice(0, 8) });
          navRef.current({ to: "/onboarding", replace: true });
          return;
        }

        // row === null: profile fetch failed (transient). If we have any local
        // profile, use it; otherwise send to onboarding so the user isn't stuck.
        if (getState().profile) {
          setLocalStateOwner(uid);
          logSessionEvent("tabs:profile-fetch-fallback-local", { user: uid.slice(0, 8) });
        } else {
          logSessionEvent("tabs:profile-fetch-fallback-onboarding", { user: uid.slice(0, 8) });
          navRef.current({ to: "/onboarding", replace: true });
        }
      } catch (e) {
        logSessionEvent("tabs:bootstrap-error", { message: e instanceof Error ? e.message : "Unknown" });
        console.warn("tabs bootstrap failed", e);
      } finally {
        finish();
      }
    })();

    const safety = setTimeout(finish, 5500);

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT" && !s) navRef.current({ to: "/auth", replace: true });
    });
    return () => {
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
