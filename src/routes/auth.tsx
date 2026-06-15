import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getMyProfile, saveProfile, signInWithUsername } from "@/lib/profile.functions";
import { profileQuestionsComplete } from "@/lib/account-restore";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const manualAuthInProgress = useRef(false);
  const usernameSignIn = useServerFn(signInWithUsername);
  const getProfile = useServerFn(getMyProfile);
  const saveStarterProfile = useServerFn(saveProfile);

  async function waitForActiveSession(timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return session;
      await delay(150);
    }
    return null;
  }

  async function ensureStarterProfile(email?: string | null) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;

    const source = email || session.user.email || "";
    const displayName =
      source.split("@")[0]?.replace(/[^a-zA-Z0-9_ -]/g, "").slice(0, 60) ||
      "DEADSET Athlete";
    const row = { id: session.user.id, display_name: displayName };

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
      if (!error) return true;
      await delay(250 * (attempt + 1));
    }

    try {
      await saveStarterProfile({ data: { display_name: displayName } });
      return true;
    } catch (error) {
      console.warn("starter profile save failed", error);
      return false;
    }
  }

  async function routeAfterAuth() {
    const session = await waitForActiveSession();
    if (!session) throw new Error("Sign-in did not finish. Please try again.");

    await ensureStarterProfile(session.user.email);

    let profile = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        profile = await getProfile();
        break;
      } catch {
        await delay(250 * (attempt + 1));
      }
    }
    navigate({ to: profileQuestionsComplete(profile) ? "/train" : "/onboarding", replace: true });
  }

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setMode("reset");
      return;
    }
    let routed = false;
    const go = () => {
      if (manualAuthInProgress.current) return;
      if (routed) return;
      routed = true;
      routeAfterAuth().catch(() => {});
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (mode === "reset") return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) go();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) go();
    }).catch(() => {});
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    manualAuthInProgress.current = true;
    setBusy(true);
    try {
      if (mode === "signup") {
        const email = identifier.trim().toLowerCase();
        if (!email.includes("@")) throw new Error("Enter a valid email to sign up");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: {
              display_name:
                email.split("@")[0]?.replace(/[^a-zA-Z0-9_ -]/g, "").slice(0, 60) ||
                "DEADSET Athlete",
            },
          },
        });
        if (error) throw error;
        // If auto-confirm is on, the listener will route. If a session wasn't
        // returned (email confirmation required), sign in immediately.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
          if (siErr) throw new Error("Account created — please sign in");
        }
        const activeSession = await waitForActiveSession();
        if (!activeSession) throw new Error("Account created — please sign in");
        await ensureStarterProfile(activeSession.user.email ?? email);
        toast.success("Welcome to DEADSET");
        await routeAfterAuth();
      } else {
        const id = identifier.trim().toLowerCase();
        if (id.includes("@")) {
          const { error } = await supabase.auth.signInWithPassword({ email: id, password });
          if (error) throw error;
        } else {
          const tokens = await usernameSignIn({ data: { username: id.replace(/^@/, ""), password } });
          if (!tokens.ok) throw new Error(tokens.error);
          const { error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
          if (error) throw error;
        }
        await routeAfterAuth();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed — check your details");
    } finally {
      manualAuthInProgress.current = false;
      setBusy(false);
    }
  }

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) throw error;
      toast.success("Reset link sent — check your email");
      setForgotEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate({ to: "/train", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  async function oauthGoogle() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) throw res.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function oauthApple() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
      if (res.error) throw res.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apple sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0A0B0D", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(225,6,0,0.18) 0%, transparent 70%)", filter: "blur(80px)", top: -120, left: "50%", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 70%)", filter: "blur(60px)", bottom: "15%", right: -80 }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1 mb-3">
            <div style={{ width: 3, height: 28, background: "#E10600", borderRadius: 2 }} />
            <span className="display font-extrabold text-5xl tracking-tight" style={{ fontStyle: "italic", color: "#ffffff", letterSpacing: "-0.02em" }}>
              DEAD<span style={{ color: "#E10600" }}>SET</span>
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: "#6B7280" }}>
            Forge Your Body
          </p>
        </div>

        {/* Feature row */}
        <div className="flex items-center justify-center gap-6 mb-8">
          {[
            { n: "500+", l: "Exercises" },
            { n: "∞", l: "Programs" },
            { n: "24/7", l: "AI Coach" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="display font-extrabold text-lg text-white">{s.n}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#6B7280" }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div
          className="w-full max-w-sm"
          style={{ background: "rgba(28,29,33,0.95)", border: "1px solid rgba(225,6,0,0.2)", borderRadius: 20, padding: 28, backdropFilter: "blur(20px)", boxShadow: "0 0 60px rgba(225,6,0,0.06), 0 20px 60px rgba(0,0,0,0.4)" }}
        >

          {/* Reset password */}
          {mode === "reset" && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Set New Password</h2>
              <p className="text-xs mb-5" style={{ color: "#8A8A8A" }}>Choose a new password for your account.</p>
              <form onSubmit={submitNewPassword} className="space-y-3">
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required minLength={6}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3.5 text-sm text-white rounded-xl pr-10"
                    style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#E10600")}
                    onBlur={(e) => (e.target.style.borderColor = "#262626")}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#6B7280" }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <SubmitButton busy={busy} label="Set Password" />
              </form>
            </>
          )}

          {/* Forgot password */}
          {mode === "forgot" && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Reset Password</h2>
              <p className="text-xs mb-5" style={{ color: "#8A8A8A" }}>Enter your email and we'll send a reset link.</p>
              <form onSubmit={sendResetEmail} className="space-y-3">
                <input
                  type="email" required autoCapitalize="none" autoCorrect="off"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3.5 text-sm text-white rounded-xl"
                  style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
                  onFocus={(e) => (e.target.style.borderColor = "#E10600")}
                  onBlur={(e) => (e.target.style.borderColor = "#262626")}
                />
                <SubmitButton busy={busy} label="Send Reset Link" />
              </form>
              <button type="button" onClick={() => setMode("signin")} className="w-full mt-4 text-xs font-semibold" style={{ color: "#8A8A8A" }}>
                ← Back to sign in
              </button>
            </>
          )}

          {/* Sign in / Sign up */}
          {(mode === "signin" || mode === "signup") && (
            <>
              {/* Tab switcher */}
              <div className="flex mb-6 p-1 rounded-xl" style={{ background: "#0A0A0A" }}>
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all"
                    style={{
                      background: mode === m ? "#E10600" : "transparent",
                      color: mode === m ? "#ffffff" : "#6B7280",
                    }}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete={mode === "signup" ? "email" : "username"}
                    placeholder={mode === "signup" ? "Email address" : "Email or username"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-4 py-3.5 text-sm text-white rounded-xl"
                    style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#E10600")}
                    onBlur={(e) => (e.target.style.borderColor = "#262626")}
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 text-sm text-white rounded-xl pr-10"
                    style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "#E10600")}
                    onBlur={(e) => (e.target.style.borderColor = "#262626")}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#6B7280" }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {mode === "signin" && (
                  <div className="text-right">
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold" style={{ color: "#8A8A8A" }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <SubmitButton busy={busy} label={mode === "signup" ? "Create Account" : "Sign In"} />
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div style={{ flex: 1, height: 1, background: "#262626" }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6B7280" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "#262626" }} />
              </div>

              {/* OAuth */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={oauthGoogle}
                  disabled={busy}
                  className="w-full py-3.5 flex items-center justify-center gap-3 text-sm font-semibold rounded-xl transition-all"
                  style={{ background: "#ffffff", color: "#0A0A0A", border: "none" }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20H24v8h11.3c-1.1 5.3-5.7 8-11.3 8-7 0-12-5.5-12-12s5-12 12-12c3 0 5.7 1.1 7.7 3l5.7-5.7C34 6.3 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20c10.6 0 20-7.7 20-20 0-1.3-.1-2.7-.4-4z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 12 24 12c3 0 5.7 1.1 7.7 3l5.7-5.7C34 6.3 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#FAFAFA" d="M24 44c5.2 0 9.9-1.9 13.4-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.6 0-10.2-3.7-11.3-9H6.1c3.3 7.1 10.4 12 17.9 12z" />
                    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.5 2.5-1.9 4.8-3.9 6.5l6.2 5.2C41 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-4z" />
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={oauthApple}
                  disabled={busy}
                  className="w-full py-3.5 flex items-center justify-center gap-3 text-sm font-semibold rounded-xl transition-all"
                  style={{ background: "#000000", color: "#ffffff", border: "1.5px solid #262626" }}
                >
                  <svg width="14" height="16" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
                    <path d="M318.7 268.7c-.2-37 16.5-65 50.5-85.6-19-27.2-47.7-42.2-85.6-45.1-35.8-2.8-75 21.1-89.3 21.1-15.1 0-49.7-20-76.9-20C72.4 140.2 24 184.5 24 274.6c0 26.6 4.9 54.1 14.6 82.4 13 36.8 60 127 109 125.5 25.6-.6 43.7-18.2 77-18.2 32.3 0 49.1 18.2 77.6 18.2 49.5-.7 92-82.6 104.4-119.6-66.6-31.4-63.9-92-63.9-93.8zM260.1 79.2c25.6-30.4 23.3-58.1 22.6-68.2-22.7 1.3-49 15.5-64 32.9-16.5 18.7-26.2 41.8-24.1 67.6 24.5 1.9 46.9-10.7 65.5-32.3z" />
                  </svg>
                  Continue with Apple
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-[10px] font-medium text-center" style={{ color: "#6B7280" }}>
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline" style={{ color: "#8A8A8A" }}>Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="underline" style={{ color: "#8A8A8A" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full py-3.5 flex items-center justify-center gap-2 text-sm font-bold rounded-xl transition-all"
      style={{
        background: busy ? "rgba(225,6,0,0.6)" : "#E10600",
        color: "#ffffff",
        boxShadow: busy ? "none" : "0 4px 20px rgba(225,6,0,0.35)",
        letterSpacing: "0.03em",
      }}
    >
      {busy ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Signing in…</span>
        </>
      ) : (
        <>
          <Zap size={15} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
