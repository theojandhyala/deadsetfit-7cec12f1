import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getState } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { navigate({ to: "/auth", replace: true }); return; }
      if (!getState().profile) { navigate({ to: "/onboarding", replace: true }); return; }
      setReady(true);
    })();
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth", replace: true });
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [navigate]);
  if (!ready) return <div className="min-h-screen bg-grit" />;
  return (
    <div className="min-h-screen bg-grit" style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
