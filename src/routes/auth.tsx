import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff, Zap, Trophy, Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigated = useRef(false);

  // Uncontrolled refs — no rerenders on keystroke
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const forgotEmailRef = useRef<HTMLInputElement>(null);

  // Detect password-reset link in URL hash
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }
  }, []);

  // Auto-redirect if already signed in (check once on mount only)
  useEffect(() => {
    navigated.current = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !navigated.current && mode !== "reset") {
        navigated.current = true;
        navigate({ to: "/train", replace: true });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    if (!email) { toast.error("Enter your email"); return; }
    if (!password) { toast.error("Enter your password"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (error) throw error;
      navigated.current = true;
      navigate({ to: "/train", replace: true });
    } catch (err: unknown) {
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
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    if (!email) { toast.error("Enter your email"); return; }
    if (!password) { toast.error("Enter your password"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });
      const data = await res.json() as { access_token?: string; refresh_token?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Sign up failed");
      await supabase.auth.setSession({ access_token: data.access_token!, refresh_token: data.refresh_token! });
      navigated.current = true;
      navigate({ to: "/train", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const email = forgotEmailRef.current?.value.trim() ?? "";
    if (!email) { toast.error("Enter your email"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth#type=recovery`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your inbox");
      setMode("signin");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const newPassword = newPasswordRef.current?.value ?? "";
    if (!newPassword || newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate({ to: "/train", replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 overflow-x-hidden"
      style={{ background: "#0A0B0D", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(225,6,0,0.15) 0%, transparent 70%)", filter: "blur(80px)", top: -150, left: "50%", transform: "translateX(-50%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1 mb-3">
            <div style={{ width: 3, height: 32, background: "#E10600", borderRadius: 2 }} />
            <span className="display font-extrabold text-5xl tracking-tight" style={{ fontStyle: "italic", color: "#ffffff", letterSpacing: "-0.02em" }}>
              DEAD<span style={{ color: "#E10600" }}>SET</span>
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: "#6B7280" }}>
            Train Smarter. Get Stronger.
          </p>
        </div>

        {/* Value props — shown only on sign up tab */}
        {mode === "signup" && (
          <div className="w-full mb-5 grid grid-cols-3 gap-2">
            {[
              { Icon: Zap, label: "AI Schedule", sub: "Built for you" },
              { Icon: Brain, label: "AI Coach", sub: "Always on" },
              { Icon: Trophy, label: "Track PRs", sub: "& celebrate" },
            ].map(({ Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl" style={{ background: "rgba(225,6,0,0.08)", border: "1px solid rgba(225,6,0,0.2)" }}>
                <Icon size={16} style={{ color: "#E10600" }} />
                <span className="text-[10px] font-bold text-white text-center leading-tight">{label}</span>
                <span className="text-[9px] text-center" style={{ color: "#6B7280" }}>{sub}</span>
              </div>
            ))}
          </div>
        )}


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
                <PasswordField inputRef={newPasswordRef} show={showPass} onToggle={() => setShowPass(v => !v)} placeholder="New password" autoComplete="new-password" />
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
                <EmailField inputRef={forgotEmailRef} />
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
                  <EmailField inputRef={emailRef} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#8A8A8A" }}>Password</label>
                  <PasswordField
                    inputRef={passwordRef}
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

                <SubmitBtn busy={busy} label={mode === "signin" ? "Sign In" : "Start Training — It's Free"} />
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
      </div>
    </div>
  );
}

function EmailField({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <input
      ref={inputRef}
      type="email"
      required
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="email"
      placeholder="your@email.com"
      className="w-full px-4 py-3.5 text-sm text-white rounded-xl"
      style={{ background: "#0A0A0A", border: "1.5px solid #262626", outline: "none" }}
      onFocus={(e) => (e.target.style.borderColor = "#E10600")}
      onBlur={(e) => (e.target.style.borderColor = "#262626")}
    />
  );
}

function PasswordField({ inputRef, show, onToggle, placeholder, autoComplete }: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={show ? "text" : "password"}
        required
        minLength={6}
        autoComplete={autoComplete ?? "current-password"}
        placeholder={placeholder ?? "Password"}
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
