import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";

import { GritLogo } from "@/components/GritLogo";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { hapticSelection } from "@/lib/haptics";

type AuthMode = "signin" | "signup";

const STRENGTH_PREVIEW = {
  CHEST: "#45bd62",
  BACK: "#3297e3",
  LEGS: "#a43ac2",
  SHOULDERS: "#ec3f83",
  ARMS: "#f59e0b",
  CORE: "#ef4444",
} as const;

const HIGHLIGHTS: Array<{ Icon: LucideIcon; label: string; detail: string }> = [
  { Icon: CalendarDays, label: "Plan", detail: "Your week, decided" },
  { Icon: Dumbbell, label: "Lift", detail: "Every set, captured" },
  { Icon: ChartNoAxesCombined, label: "Prove", detail: "Strength made visible" },
];

function nativeAuthHref(mode: AuthMode) {
  return `/auth/index.html?mode=${mode}`;
}

export function NativeWelcome() {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-x-hidden bg-[#070708] text-grit">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 78% 16%, rgba(230,50,34,0.19), transparent 31%), radial-gradient(circle at 0% 58%, rgba(230,50,34,0.08), transparent 36%), linear-gradient(180deg, #100708 0%, #070708 46%, #050506 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
          maskImage: "linear-gradient(to bottom, black, transparent 72%)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
        <header className="flex min-h-11 items-center justify-between">
          <GritLogo className="text-[26px]" />
          <a
            href={nativeAuthHref("signin")}
            onClick={hapticSelection}
            className="label-cap inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[0.045] px-4 text-[9px] text-white press"
          >
            Log in
          </a>
        </header>

        <section className="mt-7 animate-slide-up">
          <p className="deadset-kicker">YOUR TRAINING. PROVEN.</p>
          <h1 className="display mt-3 max-w-[9ch] text-[46px] font-black uppercase leading-[0.88] tracking-[-0.025em] text-white">
            Train like it counts.
          </h1>
          <p className="mt-4 max-w-sm text-[14px] font-semibold leading-6 text-white/58">
            Build your week, log every set, and watch the strength you earn come alive.
          </p>
        </section>

        <section
          className="deadset-hero-card relative mt-5 overflow-hidden rounded-[26px] border border-white/10 px-4 pb-4 pt-4"
          aria-label="DEADSET strength map preview"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-cap text-[8px] text-accent-red">SIGNATURE STRENGTH MAP</p>
              <p className="display mt-1 text-lg font-black uppercase text-white">
                See what is getting stronger
              </p>
            </div>
            <span className="label-cap rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[7px] text-grit-dim">
              REAL LIFTS
            </span>
          </div>

          <div className="relative mt-2 grid grid-cols-2 gap-5">
            <div className="text-center">
              <p className="label-cap text-[8px] text-grit-dim">START</p>
              <MuscleDiagram view="front" size={158} />
            </div>
            <div className="text-center">
              <p className="label-cap text-[8px] text-white">YOU</p>
              <MuscleDiagram view="front" gradeColors={STRENGTH_PREVIEW} size={158} />
            </div>
            <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#1b1c20] text-white shadow-xl">
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>

          <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[9px] font-bold text-white/48">
            <Check size={11} className="text-accent-red" aria-hidden="true" /> Every colour comes
            from what you actually lift.
          </p>
        </section>

        <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="What DEADSET does">
          {HIGHLIGHTS.map(({ Icon, label, detail }) => (
            <li
              key={label}
              className="rounded-2xl border border-white/[0.075] bg-white/[0.035] px-3 py-3"
            >
              <Icon size={15} className="text-accent-red" aria-hidden="true" />
              <p className="display mt-2 text-sm font-black uppercase text-white">{label}</p>
              <p className="mt-1 text-[8px] font-bold leading-3.5 text-white/42">{detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          <a
            href={nativeAuthHref("signup")}
            onClick={hapticSelection}
            className="btn-grit flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-[13px] press"
          >
            Create my account <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a
            href={nativeAuthHref("signin")}
            onClick={hapticSelection}
            className="btn-ghost mt-2.5 flex min-h-13 w-full items-center justify-center rounded-2xl text-[12px] press"
          >
            I already have an account
          </a>
          <p className="label-cap mt-3 text-center text-[7px] text-white/34">
            SET UP FIRST · 7-DAY TRIAL AFTER
          </p>
          <p className="mt-1.5 text-center text-[9px] font-semibold text-white/28">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
