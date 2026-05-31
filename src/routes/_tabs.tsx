import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getState } from "@/lib/storage";

export const Route = createFileRoute("/_tabs")({
  component: TabsLayout,
});

function TabsLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!getState().profile) navigate({ to: "/onboarding", replace: true });
  }, [navigate]);
  return (
    <div className="min-h-screen bg-grit" style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
