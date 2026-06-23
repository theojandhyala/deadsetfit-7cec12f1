import { Link } from "@tanstack/react-router";
import { useState } from "react";
import heroImg from "@/assets/gym-hero.jpg";
import aboutImg from "@/assets/landing-about.jpg";
import benefitsImg from "@/assets/landing-benefits.jpg";

const NAV = [
  { label: "FEATURES", id: "features" },
  { label: "ABOUT", id: "about" },
  { label: "BENEFITS", id: "benefits" },
  { label: "REVIEWS", id: "reviews" },
  { label: "FAQ", id: "faq" },
];

function Logo() {
  return (
    <span
      className="display font-extrabold text-2xl tracking-wider"
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
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="label-cap text-xs text-grit hover:text-accent-red transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <Link
          to="/auth"
          className="label-cap text-xs px-4 py-2 border"
          style={{ borderColor: "#E10600", color: "#E10600" }}
        >
          LOGIN
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
    <section id={id} className={`relative py-20 sm:py-28 px-4 sm:px-6 ${className}`}>
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <Section id="home" className="overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.7) 50%, rgba(10,10,10,0.4) 100%), url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
        aria-hidden="true"
      />
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1
            className="display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight animate-slide-up"
            style={{ fontStyle: "italic" }}
          >
            <span style={{ color: "#f5f5f0" }}>TRAIN SMARTER.</span>
            <br />
            <span style={{ color: "#f5f5f0" }}>TRACK EVERYTHING.</span>
            <br />
            <span style={{ color: "#E10600" }}>FORGE YOUR BODY.</span>
          </h1>
          <p className="mt-6 text-grit-dim max-w-md leading-relaxed animate-slide-up delay-150">
            DEADSET is the all-in-one fitness app built to help you plan workouts, track progress,
            and stay motivated to reach your goals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-slide-up delay-250">
            <Link
              to="/auth"
              className="label-cap text-sm px-6 py-3 inline-flex items-center gap-2"
              style={{ background: "#E10600", color: "#0a0a0a" }}
            >
              GET STARTED →
            </Link>
            <a
              href="#features"
              className="label-cap text-sm px-6 py-3"
              style={{ border: "1px solid #2a2a2a", color: "#f5f5f0" }}
            >
              LEARN MORE
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "▲", t: "LOG WORKOUTS", s: "Fast & easy" },
              { icon: "◆", t: "TRACK PROGRESS", s: "See real results" },
              { icon: "★", t: "STAY MOTIVATED", s: "Hit your goals" },
              { icon: "✦", t: "JOIN THE COMMUNITY", s: "Compete & connect" },
            ].map((f, i) => (
              <div key={i} className="text-center sm:text-left">
                <div className="text-accent-red text-xl mb-1">{f.icon}</div>
                <p className="label-cap text-[10px] text-grit">{f.t}</p>
                <p className="text-[10px] text-grit-dim mt-0.5">{f.s}</p>
              </div>
            ))}
          </div>

          <div
            className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 p-4"
            style={{ background: "rgba(20,20,20,0.7)", border: "1px solid rgba(225,6,0,0.2)" }}
          >
            {[
              { n: "FREE", l: "TO GET STARTED" },
              { n: "AI", l: "COACH BUILT IN" },
              { n: "24/7", l: "TRACK ANYWHERE" },
              { n: "∞", l: "POTENTIAL GAINS" },
            ].map((s, i) => (
              <div key={i}>
                <p className="display font-extrabold text-xl text-accent-red">{s.n}</p>
                <p className="label-cap text-[9px] text-grit-dim mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Features() {
  const items = [
    { t: "WORKOUT TRACKING", d: "Log sets, reps, and weights with ease." },
    { t: "AI MEAL SCAN", d: "Snap a photo of your plate — instant calories and macros." },
    { t: "AI COACH", d: "24/7 strength coach in your pocket. Ask anything, get answers." },
    { t: "PHYSIQUE SCANNER", d: "AI-powered body analysis: body fat, muscle, symmetry." },
    { t: "PROGRESS PICTURES", d: "Track your transformation with side-by-side check-ins." },
    { t: "LEADERBOARDS", d: "Compete with friends and climb the global ranks." },
    { t: "PROGRESS OVER TIME", d: "Visualise your gains and stay on track." },
    { t: "CUSTOM WORKOUTS", d: "Create and save your own workout plans." },
    { t: "CLOUD SYNC", d: "Access your data anywhere, anytime, on any device." },
  ];
  return (
    <Section id="features" className="bg-grit-card/30">
      <h2
        className="display font-extrabold text-4xl sm:text-5xl mb-3"
        style={{ fontStyle: "italic" }}
      >
        FEATURES
      </h2>
      <p className="text-grit-dim mb-10">
        Everything you need to take your training to the next level.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((f, i) => (
          <div
            key={i}
            className="p-5 flex gap-4"
            style={{ background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: "rgba(225,6,0,0.15)", color: "#E10600" }}
            >
              ◆
            </div>
            <div>
              <p className="label-cap text-sm text-grit">{f.t}</p>
              <p className="text-xs text-grit-dim mt-1 leading-relaxed">{f.d}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function About() {
  return (
    <Section id="about" className="overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-50"
        style={{
          backgroundImage: `linear-gradient(90deg, #0a0a0a 0%, rgba(10,10,10,0.5) 100%), url(${aboutImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
        aria-hidden="true"
      />
      <div className="max-w-xl">
        <h2
          className="display font-extrabold text-4xl sm:text-5xl mb-4"
          style={{ fontStyle: "italic" }}
        >
          <span style={{ color: "#f5f5f0" }}>ABOUT </span>
          <span style={{ color: "#E10600" }}>DEADSET</span>
        </h2>
        <p className="label-cap text-sm text-grit mb-6">
          DeadSet was built by lifters, for lifters.
        </p>
        <p className="text-grit-dim leading-relaxed mb-4">
          We know what it takes to stay consistent, push your limits, and see real progress. That's
          why we created DEADSET — a powerful yet simple fitness app to help you train smarter, not
          harder.
        </p>
        <p className="text-grit-dim leading-relaxed">
          Our mission is to give you the tools and motivation to forge your body and become the
          strongest version of yourself.
        </p>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { i: "▲", t: "BUILT BY LIFTERS", s: "For lifters" },
            { i: "◆", t: "PRIVACY FIRST", s: "Your data is yours" },
            { i: "★", t: "ALWAYS IMPROVING", s: "New features always" },
            { i: "✦", t: "PASSION DRIVEN", s: "We never stop" },
          ].map((b, i) => (
            <div key={i}>
              <div className="text-accent-red text-2xl mb-1">{b.i}</div>
              <p className="label-cap text-[11px] text-grit">{b.t}</p>
              <p className="text-[10px] text-grit-dim mt-0.5">{b.s}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Benefits() {
  const items = [
    { t: "BETTER TRAINING", d: "Follow structured workouts and track every detail." },
    { t: "MORE PROGRESS", d: "Monitor your lifts and watch your numbers go up." },
    { t: "STAY CONSISTENT", d: "Build habits and streaks that keep you motivated." },
    { t: "ACHIEVE YOUR GOALS", d: "Set goals, crush them and become your best self." },
  ];
  return (
    <Section id="benefits" className="bg-grit-card/30">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <div className="relative aspect-square lg:aspect-auto lg:h-[500px] overflow-hidden">
          <img
            src={benefitsImg}
            alt="Athlete training"
            loading="lazy"
            width={1024}
            height={1280}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(10,10,10,0.4) 100%)",
            }}
          />
        </div>
        <div>
          <h2
            className="display font-extrabold text-4xl sm:text-5xl mb-3"
            style={{ fontStyle: "italic" }}
          >
            BENEFITS
          </h2>
          <p className="text-grit-dim mb-8">
            Designed to help you train better, stay consistent, and achieve more.
          </p>
          <div className="space-y-3">
            {items.map((b, i) => (
              <div
                key={i}
                className="p-4 flex gap-4 items-start"
                style={{
                  background: "rgba(20,20,20,0.7)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{ background: "rgba(225,6,0,0.15)", color: "#E10600" }}
                >
                  ◆
                </div>
                <div>
                  <p className="label-cap text-sm text-grit">{b.t}</p>
                  <p className="text-xs text-grit-dim mt-1 leading-relaxed">{b.d}</p>
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
  return (
    <Section id="reviews">
      <div className="text-center mb-12">
        <h2
          className="display font-extrabold text-4xl sm:text-5xl mb-3"
          style={{ fontStyle: "italic" }}
        >
          REVIEWS
        </h2>
        <p className="text-grit-dim">No reviews yet — be the first to share your experience.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {[
          {
            t: "Coming soon",
            b: "We're just getting started. Help shape DEADSET by being one of our first users.",
            a: "You?",
          },
          {
            t: "Your voice matters",
            b: "Every feature we build is driven by real lifters. Drop us feedback any time.",
            a: "Founder",
          },
        ].map((r, i) => (
          <div
            key={i}
            className="p-5"
            style={{ background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="text-accent-red mb-2 text-sm">★★★★★</div>
            <p className="label-cap text-sm text-grit mb-2">{r.t}</p>
            <p className="text-xs text-grit-dim leading-relaxed mb-3">{r.b}</p>
            <p className="text-[10px] text-grit-dim">— {r.a}</p>
          </div>
        ))}
      </div>
      <div className="text-center mt-8">
        <Link
          to="/auth"
          className="label-cap text-sm px-6 py-3 inline-block"
          style={{ background: "#E10600", color: "#0a0a0a" }}
        >
          JOIN DEADSET
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
      a: "Absolutely. Your data syncs across every device you sign in on.",
    },
    {
      q: "Do I need an internet connection?",
      a: "You can log workouts offline and they'll sync when you're back online.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. Your data is encrypted in transit and at rest. You own it.",
    },
    {
      q: "Can I import/export my data?",
      a: "You can export your full history and PRs whenever you want.",
    },
    {
      q: "How do I contact support?",
      a: "Reach out via the in-app help or the contact button below.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" className="bg-grit-card/30">
      <h2
        className="display font-extrabold text-4xl sm:text-5xl mb-3"
        style={{ fontStyle: "italic" }}
      >
        FAQ
      </h2>
      <p className="text-grit-dim mb-10">Got questions? We've got answers.</p>
      <div className="space-y-3 max-w-3xl">
        {faqs.map((f, i) => (
          <button
            key={i}
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left p-4 flex items-start justify-between gap-4 press"
            style={{
              background: open === i ? "rgba(225,6,0,0.05)" : "rgba(20,20,20,0.7)",
              border: `1px solid ${open === i ? "rgba(225,6,0,0.25)" : "rgba(255,255,255,0.05)"}`,
              transition: "background 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div className="flex-1">
              <p className="label-cap text-sm text-grit">{f.q}</p>
              {open === i && (
                <p className="text-xs text-grit-dim mt-2 leading-relaxed animate-slide-down">
                  {f.a}
                </p>
              )}
            </div>
            <span
              className="text-accent-red text-xl leading-none shrink-0"
              style={{
                transition: "transform 0.2s ease",
                transform: open === i ? "rotate(0deg)" : "rotate(0deg)",
              }}
            >
              {open === i ? "−" : "+"}
            </span>
          </button>
        ))}
      </div>
      <div
        className="mt-10 max-w-3xl p-5 flex items-center justify-between gap-4"
        style={{ background: "rgba(20,20,20,0.7)", border: "1px solid rgba(225,6,0,0.25)" }}
      >
        <div>
          <p className="label-cap text-sm text-grit">STILL HAVE QUESTIONS?</p>
          <p className="text-xs text-grit-dim mt-1">We're here to help.</p>
        </div>
        <Link
          to="/auth"
          className="label-cap text-xs px-4 py-2 shrink-0"
          style={{ border: "1px solid #E10600", color: "#E10600" }}
        >
          CONTACT SUPPORT
        </Link>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-grit-card/50 py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <div className="flex gap-5 label-cap text-[10px] text-grit-dim">
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
