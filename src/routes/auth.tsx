import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { signInWithUsername } from "@/lib/profile.functions";

import { toast } from "sonner";


export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});


export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const usernameSignIn = useServerFn(signInWithUsername);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/train", replace: true });
    });
    // getSession() reads localStorage; don't timeout — falling back to null
    // was blocking returning users from auto-redirecting into the app.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/train", replace: true });
    }).catch(() => {});
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!identifier.includes("@")) throw new Error("Enter a valid email to sign up");
        const { data, error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is required — don't navigate until confirmed
          toast.success("Check your email to confirm your account, then sign in.");
          return;
        }
        toast.success("Welcome to DEADSET");
        navigate({ to: "/onboarding", replace: true });
      } else {
        const id = identifier.trim();
        if (id.includes("@")) {
          const { error } = await supabase.auth.signInWithPassword({ email: id, password });
          if (error) throw error;
        } else {
          const tokens = await usernameSignIn({ data: { username: id.replace(/^@/, ""), password } });
          const { error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
          if (error) throw error;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }


  async function oauth(provider: "google" | "apple") {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (res.error) throw res.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${provider} sign-in failed`);
      setBusy(false);
    }
  }


  return (
    <div className="min-h-screen bg-grit flex flex-col items-center justify-center px-6">
      <span className="display font-extrabold tracking-wider text-5xl mb-1" style={{ fontStyle: "italic" }}>
        <span style={{ color: "#f5f5f0" }}>DEAD</span>
        <span style={{ color: "#e63222" }}>SET</span>
      </span>
      <p className="label-cap text-grit-dim mb-8">Forge Your Body</p>

      <div className="w-full max-w-sm" style={{ background: "#1a1a1a", padding: "24px", border: "1px solid #222" }}>
        <h1 className="label-cap text-grit text-lg mb-5">{mode === "signup" ? "Create Account" : "Sign In"}</h1>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={mode === "signup" ? "EMAIL" : "EMAIL OR USERNAME"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
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
          onClick={() => oauth("google")}
          disabled={busy}
          className="w-full py-3 label-cap text-sm"
          style={{ background: "#f5f5f0", color: "#0a0a0a" }}
        >
          Continue With Google
        </button>

        <button
          onClick={() => oauth("apple")}
          disabled={busy}
          className="w-full py-3 label-cap text-sm mt-2 inline-flex items-center justify-center gap-2"
          style={{ background: "#000", color: "#fff", border: "1px solid #2a2a2a" }}
          aria-label="Continue with Apple"
        >
          <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
            <path d="M318.7 268.7c-.2-37 16.5-65 50.5-85.6-19-27.2-47.7-42.2-85.6-45.1-35.8-2.8-75 21.1-89.3 21.1-15.1 0-49.7-20-76.9-20C72.4 140.2 24 184.5 24 274.6c0 26.6 4.9 54.1 14.6 82.4 13 36.8 60 127 109 125.5 25.6-.6 43.7-18.2 77-18.2 32.3 0 49.1 18.2 77.6 18.2 49.5-.7 92-82.6 104.4-119.6-66.6-31.4-63.9-92-63.9-93.8zM260.1 79.2c25.6-30.4 23.3-58.1 22.6-68.2-22.7 1.3-49 15.5-64 32.9-16.5 18.7-26.2 41.8-24.1 67.6 24.5 1.9 46.9-10.7 65.5-32.3z"/>
          </svg>
          Continue With Apple
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="w-full mt-4 text-xs label-cap text-grit-dim"
        >
          {mode === "signup" ? "Have an account? Sign In" : "New here? Create Account"}
        </button>

      </div>

      <p className="mt-6 text-[10px] label-cap text-grit-dim text-center max-w-sm">
        By continuing you agree to our{" "}
        <Link to="/terms" className="text-grit underline">Terms</Link> and{" "}
        <Link to="/privacy" className="text-grit underline">Privacy Policy</Link>.
      </p>
    </div>

  );
}
