import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { signUpUser } from "@/lib/profile.functions";
import {
  getLoggedSession,
  logSessionEvent,
  readSessionLogs,
  recordSessionSnapshot,
} from "@/lib/session-diagnostics";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpUser);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const navigated = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Detect password-reset link in URL hash
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }
  }, []);

  // Auto-redirect if already signed in
  useEffect(() => {
    getLoggedSession("auth:auto-redirect").then((session) => {
      if (session && !navigated.current) {
        navigated.current = true;
        logSessionEvent("auth:auto-redirect-to-train");
        navigate({ to: "/train", replace: true });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      logSessionEvent("auth:state-change", { event, hasSession: Boolean(session) });
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && !navigated.current) {
        recordSessionSnapshot(`auth:${event.toLowerCase()}`, session);
        if (modeRef.current === "reset") return;
        navigated.current = true;
        navigate({ to: "/train", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter your email"); return; }
    if (!password) { toast.error("Enter your password"); return; }
    setBusy(true);
    try {
      logSessionEvent("auth:password-signin-start", { emailDomain: email.split("@")[1] ?? null });
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      const session = await getLoggedSession("auth:password-signin-success", 3500);
      if (!session) throw new Error("Signed in, but the session was not saved. Please try again.");
      if (!navigated.current) {
        navigated.current = true;
        navigate({ to: "/train", replace: true });
      }
    } catch (err: unknown) {
      logSessionEvent("auth:password-signin-error", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (msg.toLowerCase().includes("invalid login")) {
        toast.error("Wrong email or password");
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        toast.error("Can't reach server — check your connection and try again");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      logSessionEvent("auth:signup-start", { emailDomain: email.split("@")[1] ?? null });
      const result = await signUp({
        data: {
          email: email.trim().toLowerCase(),
          password,
          display_name: email.trim().split("@")[0] || "DEADSET Athlete",
        },
      });
      await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      const session = await getLoggedSession("auth:signup-session-set", 3500);
      if (!session) throw new Error("Account created, but the session was not saved. Try signing in.");
      toast.success("Account created — finish your setup");
      if (!navigated.current) {
        navigated.current = true;
        navigate({ to: "/onboarding", replace: true });
      }
    } catch (err: unknown) {
      logSessionEvent("auth:signup-error", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
      const msg = err instanceof Error ? err.message : "Sign up failed";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error("That email is already registered — try signing in");
        setMode("signin");
      } else if (msg.toLowerCase().includes("already exists")) {
        toast.error("That email is already registered — try signing in");
        setMode("signin");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
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
      setMode("signin");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await getLoggedSession("auth:password-reset-success", 3500);
      toast.success("Password updated — you're signed in");
      navigate({ to: "/train", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  const diagnosticLogs = showDiagnostics ? readSessionLogs().slice(-12).reverse() : [];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
      style={{ background: "#0A0B0D", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(225,6,0,0.18) 0%, transparent 70%)", filter: "blur(80px)", top: -120, left: "50%", transform: "translateX(-50%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
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

        {/* Card */}
        <div
          className="w-full"
          style={{ background: "rgba(28,29,33,0.95)", border: "1px solid rgba(225,6,0,0.2)", borderRadius: 20, padding: 28, backdropFilter: "blur(20px)", boxShadow: "0 0 60px rgba(225,6,0,0.06), 0 20px 60px rgba(0,0,0,0.4)" }}
        >

          {/* ── Reset password ── */}
          {mode === "reset" && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Set New Password</h2>
              <p className="text-xs mb-5" style={{ color: "#8A8A8A" }}>Choose a new password for your account.</p>
              <form onSubmit={handleReset} className="space-y-3">
                <PasswordInput value={newPassword} onChange={setNewPassword} show={showPass} onToggle={() => setShowPass(v => !v)} placeholder="New password" autoComplete="new-password" />
                <SubmitBtn busy={busy} label="Set Password" />
              </form>
            </>
          )}

          {/* ── Forgot password ── */}
          {mode === "forgot" && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Reset Password</h2>
              <p className="text-xs mb-5" style={{ color: "#8A8A8A" }}>We'll email you a reset link.</p>
              <form onSubmit={handleForgot} className="space-y-3">
                <EmailInput value={forgotEmail} onChange={setForgotEmail} />
                <SubmitBtn busy={busy} label="Send Reset Link" />
              </form>
              <button type="button" onClick={() => setMode("signin")} className="w-full mt-4 text-xs font-semibold" style={{ color: "#8A8A8A" }}>
                ← Back to sign in
              </button>
            </>
          )}

          {/* ── Sign in / Sign up ── */}
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
                    style={{ background: mode === m ? "#E10600" : "transparent", color: mode === m ? "#fff" : "#6B7280" }}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#8A8A8A" }}>Email</label>
                  <EmailInput value={email} onChange={setEmail} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#8A8A8A" }}>Password</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPass}
                    onToggle={() => setShowPass(v => !v)}
                    placeholder={mode === "signup" ? "Min. 6 characters" : "Password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>

                {mode === "signin" && (
                  <div className="text-right">
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold" style={{ color: "#8A8A8A" }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <SubmitBtn busy={busy} label={mode === "signin" ? "Sign In" : "Create Account"} />
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-[10px] font-medium text-center" style={{ color: "#6B7280" }}>
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline" style={{ color: "#8A8A8A" }}>Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="underline" style={{ color: "#8A8A8A" }}>Privacy Policy</Link>.
        </p>
        <button
          type="button"
          onClick={() => setShowDiagnostics((v) => !v)}
          className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "#6B7280" }}
        >
          Session logs
        </button>
        {showDiagnostics && (
          <div
            className="mt-3 w-full max-h-40 overflow-auto rounded-xl p-3 text-left"
            style={{ background: "#050505", border: "1px solid #262626" }}
          >
            {diagnosticLogs.length === 0 ? (
              <p className="text-[10px]" style={{ color: "#6B7280" }}>No session events yet.</p>
            ) : (
              diagnosticLogs.map((log) => (
                <div key={`${log.at}-${log.event}`} className="mb-2 last:mb-0">
                  <p className="text-[10px] font-bold" style={{ color: "#E10600" }}>{log.event}</p>
                  <p className="text-[10px] break-words" style={{ color: "#8A8A8A" }}>
                    {new Date(log.at).toLocaleTimeString()} · {JSON.stringify(log.details ?? {})}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="email"
      required
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="email"
      placeholder="your@email.com"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3.5 text-sm text-white rounded-xl"
      style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
      onFocus={(e) => (e.target.style.borderColor = "#E10600")}
      onBlur={(e) => (e.target.style.borderColor = "#262626")}
    />
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        required
        minLength={6}
        autoComplete={autoComplete ?? "current-password"}
        placeholder={placeholder ?? "Password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3.5 text-sm text-white rounded-xl pr-10"
        style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
        onFocus={(e) => (e.target.style.borderColor = "#E10600")}
        onBlur={(e) => (e.target.style.borderColor = "#262626")}
      />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#6B7280" }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function SubmitBtn({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full py-3.5 flex items-center justify-center gap-2 text-sm font-bold rounded-xl transition-all mt-1"
      style={{ background: busy ? "rgba(225,6,0,0.6)" : "#E10600", color: "#fff", boxShadow: busy ? "none" : "0 4px 20px rgba(225,6,0,0.35)", letterSpacing: "0.03em" }}
    >
      {busy ? <><Loader2 size={16} className="animate-spin" /><span>Please wait…</span></> : <span>{label}</span>}
    </button>
  );
}
