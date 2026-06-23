import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthPage,
});

const SESSION_BACKUP_KEY = "deadset_auth_session_v1";

function rememberSession(session: { access_token?: string; refresh_token?: string } | null | undefined) {
  if (!session?.access_token || !session?.refresh_token) return;
  localStorage.setItem(
    SESSION_BACKUP_KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || busy) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        rememberSession(data.session);
        if (data.session) navigate({ to: "/onboarding", replace: true });
        else toast.success("Check your email to confirm your account");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        rememberSession(data.session);
        navigate({ to: "/train", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter your email first");
      document.getElementById("auth-email")?.focus();
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080507] text-grit">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 5%, rgba(230,50,34,0.20) 0%, rgba(230,50,34,0.07) 34%, transparent 62%), linear-gradient(180deg, #140609 0%, #080507 72%)",
        }}
      />
      <div className="absolute inset-0 grid-bg opacity-[0.18]" />

      <button
        type="button"
        aria-label="Close"
        onClick={() => navigate({ to: "/" })}
        className="absolute right-3 top-3 z-20 grid h-14 w-14 place-items-center rounded-full bg-[#25262d]/90 text-[#c9c8cf] shadow-2xl"
      >
        <X size={36} strokeWidth={2.4} />
      </button>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[532px] flex-col items-center px-[28px] pb-8 pt-[86px]">
        <div className="mb-[51px] text-center">
          <div className="inline-flex items-center justify-center gap-3">
            <span className="h-9 w-1 rounded-full bg-accent-red shadow-[0_0_18px_rgba(230,50,34,0.85)]" />
            <h1
              className="display m-0 text-[56px] font-extrabold italic leading-none tracking-[-0.045em] text-white"
              style={{ textShadow: "0 0 36px rgba(230,50,34,0.34)" }}
            >
              DEAD<span className="text-accent-red">SET</span>
            </h1>
          </div>
          <p className="mt-4 text-[14px] font-extrabold uppercase tracking-[0.42em] text-[#a7a6b0]">
            Forge Your Body
          </p>
        </div>

        <section className="w-full rounded-[26px] border border-accent-red/15 bg-[#1c1d24]/95 px-[38px] pb-[30px] pt-[38px] shadow-[0_28px_90px_rgba(0,0,0,0.56),0_0_42px_rgba(230,50,34,0.10)]">
          <div className="mb-8 grid h-[60px] grid-cols-2 rounded-[18px] bg-[#050505] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-[15px] text-[17px] font-extrabold transition ${mode === "signin" ? "bg-[#f00606] text-white shadow-[0_8px_20px_rgba(230,50,34,0.32)]" : "text-[#858490]"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-[15px] text-[17px] font-extrabold transition ${mode === "signup" ? "bg-[#f00606] text-white shadow-[0_8px_20px_rgba(230,50,34,0.32)]" : "text-[#858490]"}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit}>
            <label className="mb-2.5 block text-[16px] font-extrabold text-[#9998a2]" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="your@email.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              className="mb-[18px] h-[62px] w-full rounded-[18px] border border-white/[0.055] bg-[#050505] px-[22px] text-[17px] font-bold text-grit caret-accent-red outline-none placeholder:text-[#777680] focus:border-accent-red focus:shadow-[0_0_0_1px_rgba(230,50,34,0.45)]"
            />

            <label className="mb-2.5 block text-[16px] font-extrabold text-[#9998a2]" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                className="h-[62px] w-full rounded-[18px] border border-white/[0.055] bg-[#050505] px-[22px] pr-[58px] text-[17px] font-bold text-grit caret-accent-red outline-none placeholder:text-[#777680] focus:border-accent-red focus:shadow-[0_0_0_1px_rgba(230,50,34,0.45)]"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => {
                  setShowPassword((value) => !value);
                  document.getElementById("auth-password")?.focus();
                }}
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[#737280]"
              >
                <Eye size={23} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void forgotPassword()}
              className={`ml-auto mt-6 block text-[14px] font-extrabold text-[#92919b] ${mode === "signup" ? "invisible" : ""}`}
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-16 w-full rounded-[18px] bg-[#f00606] text-[19px] font-extrabold text-white shadow-[0_12px_28px_rgba(230,50,34,0.34)] transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
            </button>
          </form>
        </section>

        <p className="mx-auto mt-6 max-w-[420px] text-center text-[11px] font-bold leading-relaxed text-[#777680]">
          By continuing you agree to our{" "}
          <Link to="/terms" className="text-[#bdbcc5] underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-[#bdbcc5] underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
