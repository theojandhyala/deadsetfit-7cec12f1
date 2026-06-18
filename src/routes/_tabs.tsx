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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navRef.current({ to: "/auth", replace: true });
          return;
        }
        const localOwner = getLocalStateOwner();
        if (getState().profile && localOwner === session.user.id) return;

        const [row] = await Promise.all([
          withTimeout(getProfileRef.current().catch(() => null), null, 7000),
          withTimeout(waitForRemoteState(session.user.id), undefined, 5000),
        ]);

        if (getState().profile && getLocalStateOwner() === session.user.id) return;

        if (row && profileQuestionsComplete(row)) {
          const accountProfile = profileFromAccount(row);
          if (accountProfile) {
            setState((current) => ({
              ...current,
              profile: accountProfile,
              schedule: current.schedule ?? defaultSchedule(accountProfile),
            }));
          }
          return;
        }

        if (row !== null && !profileQuestionsComplete(row)) {
          navRef.current({ to: "/onboarding", replace: true });
        }
      } catch (e) {
        console.warn("tabs bootstrap failed", e);
      } finally {
        finish();
      }
    })();

    const safety = setTimeout(finish, 8000);

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
