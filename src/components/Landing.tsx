import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { isNativeIos } from "@/lib/platform";
import {
  PhoneFrame,
  TrainScreen,
  LoggerScreen,
  CatalogueScreen,
  RankScreen,
} from "@/components/LandingShowcase";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Camera,
  CheckCircle2,
  Cloud,
  Dumbbell,
  Flame,
  Gauge,
  LineChart,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Utensils,
  Zap,
} from "lucide-react";

const NAV = [
  { label: "FEATURES", id: "features" },
  { label: "SYSTEM", id: "about" },
  { label: "RESULTS", id: "benefits" },
  { label: "PRICING", id: "pricing" },
  { label: "FAQ", id: "faq" },
];

function Logo() {
  return (
    <span
      className="display text-2xl font-extrabold tracking-wider"
      style={{ fontStyle: "italic" }}
    >
      <span style={{ color: "#f5f5f0" }}>DEAD</span>
      <span style={{ color: "#E10600" }}>SET</span>
    </span>
  );
}

function Nav() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        // No backdrop-filter: sticky bars with backdrop blur flash black while
        // scrolling in WKWebView/iOS Safari.
        background: "rgba(7,7,7,0.96)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="label-cap text-xs text-grit-dim transition-colors hover:text-accent-red"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <Link
          to="/auth"
          className="label-cap press inline-flex min-h-10 items-center gap-2 rounded-full border px-5 py-2 text-xs text-grit"
          style={{
            borderColor: "rgba(230,50,34,.55)",
            background: "linear-gradient(135deg, rgba(230,50,34,.18), rgba(255,255,255,.035))",
            boxShadow: "0 0 30px rgba(230,50,34,.12)",
          }}
        >
          Login <ArrowRight size={13} />
        </Link>
      </div>
    </header>
  );
}

function Section({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative px-4 py-20 sm:px-6 sm:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

function Hero() {
  const proof = ["Live set logging", "Auto PR detection", "Ranked leagues", "Progress photos"];
  return (
    <section id="home" className="relative overflow-hidden px-4 sm:px-6">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(225,6,0,0.22), transparent 60%), linear-gradient(180deg, #0a0607 0%, #050505 55%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(ellipse 80% 55% at 50% 25%, black, transparent 80%)",
        }}
        aria-hidden="true"
      />
      <div className="mx-auto max-w-3xl pt-14 pb-4 text-center sm:pt-20">
        <div className="mb-6 flex justify-center animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-red/30 bg-accent-red/10 px-4 py-2">
            <Zap size={14} className="text-accent-red" />
            <span className="label-cap text-[10px] text-grit">Built for the lift, not the feed</span>
          </span>
        </div>
        <h1 className="display animate-slide-up text-[clamp(3rem,13vw,6rem)] font-black uppercase leading-[0.86] text-grit">
          <span className="block">Train like</span>
          <span className="block text-accent-red">it counts.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl animate-slide-up text-base leading-7 text-grit-dim sm:text-lg">
          The gym tracker built for lifters who want proof, not vibes. Log every set, catch every PR,
          and climb the ranks — all in one sharp loop.
        </p>
        <div className="mt-8 flex animate-slide-up flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/auth" className="btn-grit w-full max-w-xs rounded-2xl px-8 py-4 text-sm sm:w-auto">
            Get started free <ArrowRight size={16} className="ml-2" />
          </Link>
          <a href="#showcase" className="btn-ghost w-full max-w-xs rounded-2xl px-8 py-4 text-sm sm:w-auto">
            See it in action
          </a>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {proof.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-grit-dim"
            >
              <CheckCircle2 size={12} className="text-accent-red" />
              {item}
            </span>
          ))}
        </div>
      </div>
      {/* The product, front and centre */}
      <div className="relative mx-auto mt-6 max-w-md animate-float-in pb-4">
        <PhoneFrame>
          <TrainScreen />
        </PhoneFrame>
      </div>
    </section>
  );
}

function ShowcaseRow({
  eyebrow,
  title,
  body,
  bullets,
  screen,
  flip,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  screen: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? "" : ""}`}>
      <div className={flip ? "lg:order-2" : ""}>
        <p className="label-cap text-[10px] text-accent-red">{eyebrow}</p>
        <h3 className="display mt-2 text-3xl font-extrabold uppercase leading-[0.95] text-grit sm:text-5xl">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-grit-dim">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-grit">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent-red" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>
        <PhoneFrame className="mx-auto max-w-[300px]">{screen}</PhoneFrame>
      </div>
    </div>
  );
}

function Features() {
  const extras: { Icon: typeof Camera; t: string; d: string }[] = [
    { Icon: Utensils, t: "NUTRITION + MACROS", d: "Barcode scan, fast logging, protein per kg and macro split." },
    { Icon: CalendarDays, t: "PROVEN PROGRAMS", d: "5/3/1, StrongLifts, PHUL, Arnold, nSuns — or build your own." },
    { Icon: ShieldCheck, t: "STREAK ARMOR", d: "Miss a day, keep the fire. Auto-shields protect your streak." },
    { Icon: LineChart, t: "STRENGTH STANDARDS", d: "Big-three classified untrained → elite, with rep-max tables." },
    { Icon: Medal, t: "CHALLENGES + BADGES", d: "25 tests to ELITE tier, and a trophy case that proves it." },
    { Icon: Cloud, t: "SYNC + EXPORT", d: "Your state syncs across devices. Export your history any time." },
  ];
  return (
    <section id="showcase" className="relative overflow-hidden bg-[#050505] px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center sm:mb-20">
          <p className="label-cap text-[10px] text-accent-red">The whole loop, one app</p>
          <h2 className="display mt-2 text-4xl font-extrabold uppercase text-grit sm:text-6xl">
            Everything you need.<span className="block text-accent-red">Nothing you don&apos;t.</span>
          </h2>
        </div>
        <div className="space-y-24 sm:space-y-32">
          <ShowcaseRow
            eyebrow="Log · Detect · Celebrate"
            title={<>Every set.<br />Every PR.</>}
            body="Tap to log as you lift — weight × reps, prefilled from last time. Every rep is checked against your full history, so real PRs are detected, never self-reported."
            bullets={["Crash-safe live logging", "Automatic PR detection + flames", "Plate math and warm-up ramps"]}
            screen={<LoggerScreen />}
          />
          <ShowcaseRow
            flip
            eyebrow="See the work pay off"
            title={<>Watch yourself<br />change.</>}
            body="Your journey in one place: before/after photos side by side, a wall of every PR you've hit, and each lift's climb charted over time."
            bullets={["Before → now photo comparison", "PR wall with progression sparklines", "Bodyweight and measurement trends"]}
            screen={<CatalogueScreen />}
          />
          <ShowcaseRow
            eyebrow="Real competition"
            title={<>Climb the<br />ranks.</>}
            body="Earn grit for every session, PR and streak day. Climb ranked divisions from Bronze to Elite, top the leaderboards, and take rivals head-to-head."
            bullets={["Nine divisions, weekly leagues", "Grit-ranked global leaderboards", "Head-to-head challenges"]}
            screen={<RankScreen />}
          />
        </div>

        {/* Everything else */}
        <div className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map(({ Icon, ...f }) => (
            <div key={f.t} className="deadset-card-soft flex gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-red/30 bg-accent-red/10 text-accent-red">
                <Icon size={18} />
              </div>
              <div>
                <p className="label-cap text-sm text-grit">{f.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-grit-dim">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  const values = [
    { Icon: Dumbbell, t: "BUILT BY LIFTERS", s: "For real sessions" },
    { Icon: ShieldCheck, t: "PRIVACY FIRST", s: "Your data is yours" },
    { Icon: Sparkles, t: "ALWAYS IMPROVING", s: "Useful updates" },
    { Icon: Users, t: "COMMUNITY READY", s: "Train with rivals" },
  ];
  return (
    <Section id="about" className="overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 88% 50%, rgba(225,6,0,0.10), transparent 70%), #0a0a0a",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-10 top-1/2 -z-10 hidden -translate-y-1/2 select-none lg:block"
        aria-hidden="true"
      >
        <span
          className="display text-[11rem] font-black uppercase leading-none"
          style={{
            fontStyle: "italic",
            color: "transparent",
            WebkitTextStroke: "1px rgba(230,50,34,0.22)",
          }}
        >
          GRIT
        </span>
      </div>
      <div className="max-w-2xl">
        <h2
          className="display mb-4 text-4xl font-extrabold sm:text-5xl"
          style={{ fontStyle: "italic" }}
        >
          <span className="text-grit">THE SYSTEM </span>
          <span className="text-accent-red">BEHIND THE BODY</span>
        </h2>
        <p className="label-cap mb-6 text-sm text-grit">
          Train. Log. Learn. Level up.
        </p>
        <p className="mb-4 leading-relaxed text-grit-dim">
          DEADSET is built for lifters who want useful structure without a bloated fitness feed.
          Plan the week, record the work, understand what changed, and make the next session better.
        </p>
        <p className="leading-relaxed text-grit-dim">
          No gimmicks. You build the split, log the work, and the app shows you exactly what moved:
          volume, PRs, streaks, and where you sit against everyone else.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {values.map(({ Icon, ...b }) => (
            <div key={b.t}>
              <Icon size={22} className="mb-2 text-accent-red" />
              <p className="label-cap text-[11px] text-grit">{b.t}</p>
              <p className="mt-0.5 text-[10px] text-grit-dim">{b.s}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Benefits() {
  const items = [
    {
      Icon: Dumbbell,
      t: "BETTER TRAINING",
      d: "Follow structured workouts and track every detail.",
    },
    { Icon: LineChart, t: "MORE PROGRESS", d: "Monitor your lifts and watch your numbers move." },
    {
      Icon: Flame,
      t: "STAY CONSISTENT",
      d: "Use streaks, quests, and reminders without turning training into clutter.",
    },
    {
      Icon: Trophy,
      t: "ACHIEVE YOUR GOALS",
      d: "Set a direction, measure the work, then adjust intelligently.",
    },
  ];
  return (
    <Section id="benefits" className="bg-grit-card/30">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="relative mx-auto w-full max-w-[400px]">
          <div className="absolute -inset-10 rounded-[48px] bg-accent-red/15 blur-3xl" aria-hidden="true" />
          <div
            className="relative overflow-hidden rounded-[32px] border border-white/10 p-4"
            style={{
              background: "linear-gradient(160deg, #141415, #0a0a0b 60%)",
              boxShadow:
                "0 30px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px rgba(225,6,0,0.08)",
            }}
          >
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="label-cap text-[9px] text-accent-red">LIVE · PUSH DAY</p>
                <p className="display text-lg font-black uppercase text-grit">Bench Press</p>
              </div>
              <div className="text-right">
                <p className="label-cap text-[8px] text-grit-dim">ELAPSED</p>
                <p className="font-mono text-sm font-extrabold tabular-nums text-grit">32:15</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { set: 1, txt: "80 kg × 8", pr: false },
                { set: 2, txt: "80 kg × 8", pr: false },
                { set: 3, txt: "82.5 kg × 6", pr: true },
              ].map((s) => (
                <div
                  key={s.set}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
                >
                  <span className="label-cap text-[9px] text-grit-dim">SET {s.set}</span>
                  <span className="display text-base font-extrabold text-grit">
                    {s.txt}
                    {s.pr && <Flame size={13} className="ml-2 inline text-accent-red" />}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-2.5">
                <div>
                  <p className="label-cap text-[8px] text-accent-red">NEW PR DETECTED</p>
                  <p className="text-xs font-bold text-grit">82.5kg beats your 80kg best</p>
                </div>
                <Trophy size={16} className="text-accent-red" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
                <div>
                  <p className="label-cap text-[8px] text-grit-dim">REST</p>
                  <p className="font-mono text-lg font-extrabold tabular-nums text-grit">01:24</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[25, 2.5, 1.25].map((p) => (
                    <span
                      key={p}
                      className="display rounded-full border border-accent-red/40 px-2 py-0.5 text-[10px] font-extrabold text-grit"
                    >
                      {p}
                    </span>
                  ))}
                  <span className="label-cap ml-1 text-[7px] text-grit-dim">PER SIDE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2
            className="display mb-3 text-4xl font-extrabold sm:text-5xl"
            style={{ fontStyle: "italic" }}
          >
            BUILT TO
            <span className="block text-accent-red">KEEP YOU MOVING</span>
          </h2>
          <p className="mb-8 text-grit-dim">
            A sharper feedback loop for training, nutrition, and progress.
          </p>
          <div className="space-y-3">
            {items.map(({ Icon, ...b }) => (
              <div
                key={b.t}
                className="deadset-card-soft flex items-start gap-4 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-red/30 bg-accent-red/10 text-accent-red">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="label-cap text-sm text-grit">{b.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-grit-dim">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Reviews() {
  const notes = [
    {
      t: "For TikTok attention spans",
      b: "Fast actions, strong visuals, rank cards, and instant feedback make progress feel postable without making the app shallow.",
      a: "Product focus",
    },
    {
      t: "Every tool has a job",
      b: "Split builder, food log, progress charts and leagues all feed the next training decision instead of cluttering the screen.",
      a: "DEADSET team",
    },
  ];
  return (
    <Section id="reviews">
      <div className="mb-12 text-center">
        <h2
          className="display mb-3 text-4xl font-extrabold sm:text-5xl"
          style={{ fontStyle: "italic" }}
        >
          PROOF OF WORK
        </h2>
        <p className="text-grit-dim">Early-access product notes from the training floor.</p>
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {notes.map((r) => (
          <div key={r.t} className="deadset-card-soft p-5">
            <Sparkles size={18} className="mb-3 text-accent-red" />
            <p className="label-cap mb-2 text-sm text-grit">{r.t}</p>
            <p className="mb-3 text-xs leading-relaxed text-grit-dim">{r.b}</p>
            <p className="text-[10px] text-grit-dim">— {r.a}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link to="/auth" className="btn-grit inline-flex px-6 py-3 text-sm">
          Join DEADSET
        </Link>
      </div>
    </Section>
  );
}

function Pricing() {
  const nativeIos = isNativeIos();
  const free = [
    "Live set logging + auto PR detection",
    "Split builder + 1 custom program",
    "Food, water and macro logging",
    "Progress photos, weight, measurements",
    "Challenges, feed and leaderboards",
  ];
  const pro = [
    "Streak Armor — 3 shields a month",
    "Strength standards + rep-max tables",
    "Muscle recovery tracking",
    "Advanced nutrition + photo comparison",
    "Featured programs + unlimited customs",
    "Full leagues, elite challenges + badges",
  ];
  return (
    <Section id="pricing" className="bg-[#050505]">
      <div className="mb-12 text-center">
        <h2
          className="display mb-3 text-4xl font-extrabold sm:text-5xl"
          style={{ fontStyle: "italic" }}
        >
          START FREE.
          <span className="text-accent-red"> GO PRO WHEN IT MATTERS.</span>
        </h2>
        <p className="text-grit-dim">No card required to start. Cancel any time.</p>
      </div>
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="deadset-card-soft flex flex-col p-6">
          <p className="label-cap text-sm text-grit">FREE</p>
          <p className="display mt-2 text-4xl font-black text-grit">
            £0<span className="label-cap ml-1 text-[10px] text-grit-dim">forever</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {free.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-xs text-grit-dim">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-grit-dim" />
                {f}
              </li>
            ))}
          </ul>
          <Link to="/auth" className="btn-ghost mt-6 w-full py-3 text-center text-sm">
            Start training
          </Link>
        </div>
        <div
          className="relative flex flex-col rounded-[22px] p-6"
          style={{
            background: "linear-gradient(160deg, rgba(225,6,0,0.12), rgba(20,20,20,0.9))",
            border: "1.5px solid rgba(225,6,0,0.45)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4), 0 0 60px rgba(225,6,0,0.14)",
          }}
        >
          <span className="label-cap absolute -top-2.5 left-6 rounded-full border border-accent-red/50 bg-[#050505] px-2.5 py-0.5 text-[9px] text-accent-red">
            MOST SERIOUS
          </span>
          <p className="label-cap text-sm text-accent-red">DEADSET PRO</p>
          {nativeIos ? (
            <p className="display mt-2 text-4xl font-black text-grit">
              Coming soon
              <span className="label-cap ml-1 block text-[10px] text-grit-dim">to iPhone</span>
            </p>
          ) : (
            <>
              <p className="display mt-2 text-4xl font-black text-grit">
                £4.99<span className="label-cap ml-1 text-[10px] text-grit-dim">/ month</span>
              </p>
              <p className="label-cap mt-1 text-[10px] text-grit-dim">or £39.99/yr — save 33%</p>
            </>
          )}
          <ul className="mt-5 flex-1 space-y-2.5">
            {pro.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-xs text-grit">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent-red" />
                {f}
              </li>
            ))}
          </ul>
          <Link to="/auth" className="btn-grit mt-6 w-full py-3 text-center text-sm">
            {nativeIos ? "Start training" : "Go Pro"}
          </Link>
        </div>
      </div>
      {!nativeIos && (
        <p className="mt-6 text-center text-[10px] text-grit-dim">
          Prices shown in GBP — local currency applied at checkout.
        </p>
      )}
    </Section>
  );
}

function FAQ() {
  const nativeIos = isNativeIos();
  const faqs = [
    {
      q: "Is DEADSET free to use?",
      a: "Yes. You can start tracking workouts and progress for free, no card required.",
    },
    // App Store Guideline 3.1.1: no subscription price or checkout mention on iOS.
    ...(nativeIos
      ? []
      : [
          {
            q: "What does Pro cost?",
            a: "£4.99/month or £39.99/year (save 33%). Local currency is applied at checkout, and you can cancel any time.",
          },
        ]),
    {
      q: "Can I use DEADSET on multiple devices?",
      a: "Yes. Sign in and your app state syncs across devices.",
    },
    {
      q: "Does everything work on iPhone?",
      a: "Yes. The bundled iOS app talks to the live DEADSET API when you are online and signed in.",
    },
    {
      q: "Do I need an internet connection?",
      a: "Core logging is local-first. Sync, leagues, auth, and billing require a connection.",
    },
    {
      q: "Is my data secure?",
      a: "Your data is encrypted in transit and stored through managed backend services. You can export your history.",
    },
    {
      q: "How do I contact support?",
      a: "Use the support links in the app or email support@deadsetfit.org.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" className="bg-grit-card/30">
      <h2
        className="display mb-3 text-4xl font-extrabold sm:text-5xl"
        style={{ fontStyle: "italic" }}
      >
        FAQ
      </h2>
      <p className="mb-10 text-grit-dim">Plain answers before you start logging.</p>
      <div className="max-w-3xl space-y-3">
        {faqs.map((f, i) => (
          <button
            key={f.q}
            onClick={() => setOpen(open === i ? null : i)}
            className="press flex w-full items-start justify-between gap-4 p-4 text-left"
            style={{
              background: open === i ? "rgba(225,6,0,0.05)" : "rgba(20,20,20,0.7)",
              border: `1px solid ${open === i ? "rgba(225,6,0,0.25)" : "rgba(255,255,255,0.05)"}`,
            }}
          >
            <div className="flex-1">
              <p className="label-cap text-sm text-grit">{f.q}</p>
              {open === i && (
                <p className="animate-slide-down mt-2 text-xs leading-relaxed text-grit-dim">
                  {f.a}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xl leading-none text-accent-red">
              {open === i ? "-" : "+"}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-10 flex max-w-3xl items-center justify-between gap-4 border border-accent-red/25 bg-black/25 p-5">
        <div>
          <p className="label-cap text-sm text-grit">STILL HAVE QUESTIONS?</p>
          <p className="mt-1 text-xs text-grit-dim">We are here to help.</p>
        </div>
        <a
          href="mailto:support@deadsetfit.org"
          className="label-cap shrink-0 border border-accent-red px-4 py-2 text-xs text-accent-red"
        >
          CONTACT SUPPORT
        </a>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-grit-card/50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo />
        <div className="label-cap flex gap-5 text-[10px] text-grit-dim">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </div>
        <p className="text-[10px] text-grit-dim">© {new Date().getFullYear()} DEADSET</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-grit text-grit-text">
      <Nav />
      <Hero />
      <Features />
      <About />
      <Reviews />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
