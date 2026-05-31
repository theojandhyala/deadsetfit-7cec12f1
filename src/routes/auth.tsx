import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GritLogo } from "@/components/GritLogo";
import { resolveUsernameToEmail } from "@/lib/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/train", replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/train", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to DEADSET");
          navigate({ to: "/onboarding", replace: true });
        } else {
          toast.success("Account created. Check your email to confirm.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) throw res.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-grit flex flex-col items-center justify-center px-6">
      <GritLogo className="text-5xl mb-1" />
      <p className="label-cap text-grit-dim mb-8">Forge Your Body</p>

      <div className="w-full max-w-sm" style={{ background: "#1a1a1a", padding: "24px", border: "1px solid #222" }}>
        <h1 className="label-cap text-grit text-lg mb-5">{mode === "signup" ? "Create Account" : "Sign In"}</h1>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="EMAIL"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-3 text-sm uppercase tracking-wider"
            style={{ background: "#0a0a0a", color: "#f5f5f0", border: "1px solid #2a2a2a" }}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-3 text-sm uppercase tracking-wider"
            style={{ background: "#0a0a0a", color: "#f5f5f0", border: "1px solid #2a2a2a" }}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 label-cap text-sm"
            style={{ background: "#e63222", color: "#0a0a0a" }}
          >
            {busy ? "..." : mode === "signup" ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
          <span className="text-[10px] label-cap text-grit-dim">OR</span>
          <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
        </div>

        <button
          onClick={google}
          disabled={busy}
          className="w-full py-3 label-cap text-sm"
          style={{ background: "#f5f5f0", color: "#0a0a0a" }}
        >
          Continue With Google
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="w-full mt-4 text-xs label-cap text-grit-dim"
        >
          {mode === "signup" ? "Have an account? Sign In" : "New here? Create Account"}
        </button>

      </div>
    </div>
  );
}
