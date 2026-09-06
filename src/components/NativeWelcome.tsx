import { ArrowRight, CalendarDays, Dumbbell, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";

import { hapticSelection } from "@/lib/haptics";

type AuthMode = "signin" | "signup";

const PROOF = [
  { Icon: CalendarDays, value: "YOUR WEEK", label: "built around you" },
  { Icon: Dumbbell, value: "EVERY SET", label: "turned into progress" },
  { Icon: ScanLine, value: "YOUR MAP", label: "strength made visible" },
] as const;

function nativeAuthHref(mode: AuthMode) {
  return `/auth/index.html?mode=${mode}`;
}

export function NativeWelcome() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(true), 1050);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      className={`native-entry min-h-[100dvh] overflow-hidden bg-[#050505] text-grit ${revealed ? "is-revealed" : ""}`}
    >
      <div className="native-entry-grid" aria-hidden="true" />
      <div className="native-entry-aura" aria-hidden="true" />
      <div className="native-entry-scan" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
        <section className="native-entry-brand flex flex-1 flex-col items-center justify-center text-center">
          <p className="native-entry-eyebrow">FORGE YOUR BODY</p>
          <div className="native-entry-wordmark" aria-label="DEADSET">
            <span className="native-entry-dead">DEAD</span>
            <span className="native-entry-set">SET</span>
          </div>
          <div className="native-entry-strike" aria-hidden="true" />
          <p className="native-entry-promise">
            Your plan. Your lifts. Your strength—finally visible.
          </p>
        </section>

        <section className="native-entry-actions" aria-label="Start using DEADSET">
          <ul className="native-entry-proof" aria-label="What DEADSET builds for you">
            {PROOF.map(({ Icon, value, label }) => (
              <li key={value}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  <strong>{value}</strong>
                  <small>{label}</small>
                </span>
              </li>
            ))}
          </ul>

          <a
            href={nativeAuthHref("signup")}
            onClick={hapticSelection}
            className="btn-grit native-entry-primary press"
          >
            Get started <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className="native-entry-login">
            Already have an account?{" "}
            <a href={nativeAuthHref("signin")} onClick={hapticSelection}>
              Log in
            </a>
          </p>
          <p className="native-entry-legal">
            By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
