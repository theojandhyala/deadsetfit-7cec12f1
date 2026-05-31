import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getState } from "@/lib/storage";
import { GritLogo } from "@/components/GritLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — Forge Your Body" },
      { name: "description", content: "DEADSET is your no-nonsense gym companion. Train. Build. Become." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { navigate({ to: "/auth", replace: true }); return; }
      const s = getState();
      if (s.profile) navigate({ to: "/train", replace: true });
      else navigate({ to: "/onboarding", replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-grit">
      <GritLogo className="text-6xl" />
      <p className="mt-3 label-cap text-grit">Forge Your Body</p>
    </div>
  );
}
