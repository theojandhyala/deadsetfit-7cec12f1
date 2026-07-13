import { Link } from "@tanstack/react-router";
import { useState } from "react";
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

import aboutImg from "@/assets/landing-about.jpg";
import benefitsImg from "@/assets/landing-benefits.jpg";
import heroImg from "@/assets/gym-hero.jpg";

const NAV = [
  { label: "FEATURES", id: "features" },
  { label: "SYSTEM", id: "about" },
  { label: "RESULTS", id: "benefits" },
  { label: "PROOF", id: "reviews" },
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
        background: "rgba(7,7,7,0.84)",
        backdropFilter: "blur(18px)",
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
          className="label-cap press inline-flex min-h-10 items-center gap-2 border px-4 py-2 text-xs text-grit"
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
  const proof = ["Streak armor", "PR tracking", "Friends + ranks", "Weekly leagues"];
  const metrics = [
    { label: "Today's plan", value: "Push strength", Icon: Target },
    { label: "Readiness", value: "87%", Icon: Gauge },
    { label: "Next PR", value: "Bench +2.5kg", Icon: Medal },
  ];

  return (
    <section id="home" className="relative overflow-hidden px-4 sm:px-6">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5,5,5,0.98) 0%, rgba(7,7,7,0.9) 42%, rgba(7,7,7,0.46) 78%, rgba(5,5,5,0.72) 100%), linear-gradient(180deg, rgba(5,5,5,0.1) 0%, #050505 100%), url(${heroImg})`,
          backgroundPosition: "center right",
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(90deg, black, transparent 78%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute left-0 top-24 -z-10 h-72 w-72 rounded-full bg-accent-red/10 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid min-h-[calc(100svh-64px)] max-w-7xl items-center gap-12 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.04fr_.96fr]">
        <div className="w-full max-w-[58rem] animate-slide-up">
          <div className="mb-5 flex max-w-full flex-wrap items-center gap-2 sm:mb-7">
            <span className="inline-flex items-center gap-2 border border-accent-red/30 bg-accent-red/10 px-3 py-2">
              <Zap size={14} className="text-accent-red" />
              <span className="label-cap text-[9px] text-grit sm:text-[10px]">Built for the lift, not the feed</span>
            </span>
            <span className="hidden border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-grit-dim sm:inline-flex">
              iOS ready training system
            </span>
          </div>
          <h1 className="display max-w-[9ch] text-[clamp(3.1rem,14vw,4.2rem)] font-black uppercase leading-[0.84] text-grit sm:max-w-[12ch] sm:text-[clamp(5.5rem,11vw,7.2rem)] lg:text-[clamp(6.5rem,8.4vw,8.6rem)]">
            <span className="block animate-hero-word">Train smarter.</span>
            <span className="block animate-hero-word text-white/90 [animation-delay:90ms]">Track everything.</span>
            <span className="block animate-hero-word text-accent-red [animation-delay:180ms]">Forge your body.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-grit-dim sm:text-lg">
            DEADSET turns workouts, PRs, food, progress photos, friends, and ranked competition into
            one sharp training loop. Open it, lift, log, improve, repeat.
          </p>
          <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
            <Link to="/auth" className="btn-grit min-h-12 rounded-none px-7 py-4 text-sm">
              Get started <ArrowRight size={16} className="ml-2" />
            </Link>
            <a href="#features" className="btn-ghost min-h-12 rounded-none px-7 py-4 text-sm">
              Explore system
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {proof.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-grit-dim"
              >
                <CheckCircle2 size={13} className="text-accent-red" />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[430px] animate-float-in lg:mr-0">
          <div className="absolute -inset-8 rounded-[42px] bg-accent-red/10 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden border border-white/10 bg-black/55 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <Logo />
              <span className="label-cap text-[9px] text-accent-red">Live build</span>
            </div>
            <div className="space-y-3">
              {metrics.map(({ Icon, ...item }, index) => (
                <div
                  key={item.label}
                  className="animate-metric-in border border-white/10 bg-white/[0.035] p-4"
                  style={{ animationDelay: `${220 + index * 90}ms` }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center border border-accent-red/30 bg-accent-red/10 text-accent-red">
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="label-cap text-[9px] text-grit-dim">{item.label}</p>
                        <p className="mt-1 text-sm font-black text-grit">{item.value}</p>
                      </div>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-[#4ade80] shadow-[0_0_18px_rgba(74,222,128,.75)]" />
                  </div>
                </div>
              ))}
              <div className="relative overflow-hidden border border-accent-red/30 bg-accent-red/10 p-4">
                <div className="absolute inset-y-0 left-0 w-1 bg-accent-red" />
                <p className="label-cap text-[9px] text-accent-red">Weekly league</p>
                <p className="mt-2 text-sm leading-6 text-grit">
                  2nd in Gold division. One more logged session this week and you promote.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["STR", "GRIT", "RANK"].map((label, i) => (
                  <div key={label} className="border border-white/10 bg-black/45 p-3 text-center">
                    <p className="display text-2xl font-black text-grit">{[82, 640, 12][i]}</p>
                    <p className="label-cap mt-1 text-[8px] text-grit-dim">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      Icon: Camera,
      t: "PROGRESS PHOTOS",
      d: "Weekly check-ins side by side, plus weight and measurements, so change is obvious.",
    },
    {
      Icon: Utensils,
      t: "FOOD + MACRO LOG",
      d: "Barcode lookup, fast presets and manual entry. Calories, protein and water, tracked honestly.",
    },
    {
      Icon: CalendarDays,
      t: "SPLIT BUILDER",
      d: "Build your week day by day: pick the muscles, set the sets and reps, pull from the full library.",
    },
    {
      Icon: Dumbbell,
      t: "WORKOUT TRACKING",
      d: "Log sets quickly, finish sessions, spot PRs, and keep the record clean.",
    },
    {
      Icon: LineChart,
      t: "PROGRESS OVER TIME",
      d: "See bodyweight, measurements, consistency, and lifting history in one place.",
    },
    {
      Icon: Trophy,
      t: "LEADERBOARDS",
      d: "Compete with friends and climb ranked arenas without losing sight of your own plan.",
    },
    {
      Icon: Cloud,
      t: "CLOUD SYNC",
      d: "Keep your profile and training state available across devices.",
    },
    {
      Icon: ShieldCheck,
      t: "CONTROL YOUR DATA",
      d: "Export your history and manage account data from inside the app.",
    },
  ];
  return (
    <Section id="features" className="bg-[#050505]">
      <h2
        className="display mb-3 text-4xl font-extrabold sm:text-6xl"
        style={{ fontStyle: "italic" }}
      >
        ALL SIGNAL.
        <span className="block text-accent-red">NO NOISE.</span>
      </h2>
      <p className="mb-10 max-w-2xl text-grit-dim">
        A tighter training system: logging, food, progress, and rank progression in one place.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ Icon, ...f }) => (
          <div key={f.t} className="deadset-card-soft group flex gap-4 p-5 transition-transform duration-200 hover:-translate-y-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent-red/30 bg-accent-red/10 text-accent-red">
              <Icon size={18} />
            </div>
            <div>
              <p className="label-cap text-sm text-grit">{f.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-grit-dim">{f.d}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
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
        className="absolute inset-0 -z-10 opacity-50"
        style={{
          backgroundImage: `linear-gradient(90deg, #0a0a0a 0%, rgba(10,10,10,0.58) 100%), url(${aboutImg})`,
          backgroundPosition: "center right",
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
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
        <div className="relative aspect-square overflow-hidden lg:h-[500px] lg:aspect-auto">
          <img
            src={benefitsImg}
            alt="Athlete training"
            loading="lazy"
            width={1024}
            height={1280}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(10,10,10,0.45) 100%)",
            }}
          />
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
                className="flex items-start gap-4 border border-white/10 bg-black/25 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent-red/30 bg-accent-red/10 text-accent-red">
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

function FAQ() {
  const faqs = [
    {
      q: "Is DEADSET free to use?",
      a: "Yes. You can start tracking workouts and progress for free, no card required.",
    },
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
      <Benefits />
      <Reviews />
      <FAQ />
      <Footer />
    </div>
  );
}
