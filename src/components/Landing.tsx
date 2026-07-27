import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { isNativeIos } from "@/lib/platform";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  Dumbbell,
  HeartPulse,
  LineChart,
  Medal,
  ShieldCheck,
  Trophy,
  Watch,
  Zap,
} from "lucide-react";

const navigation = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pro", href: "#pricing" },
];

function Logo() {
  return (
    <span className="display whitespace-nowrap text-xl font-bold" aria-label="DEADSET">
      <span className="text-[#f4f3ef]">DEAD</span>
      <span className="text-accent-red">SET</span>
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-5 px-5 sm:px-6">
        <a href="#top" className="inline-flex min-h-11 items-center">
          <Logo />
        </a>

        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          to="/auth"
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full border border-accent-red/55 bg-accent-red/5 px-5 text-sm font-bold text-white transition-colors hover:border-accent-red hover:bg-accent-red/10 lg:ml-2"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

const heroFeatures = ["Live set logging", "Auto PR detection", "Ranked leagues", "Progress photos"];

function Hero() {
  return (
    <section id="top" className="overflow-hidden border-b border-white/10 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-5 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-slide-up inline-flex min-h-11 items-center gap-2 rounded-full border border-accent-red/40 bg-accent-red/5 px-5 text-[11px] font-bold uppercase text-white/55 sm:text-xs">
            <Zap size={15} className="text-accent-red" aria-hidden="true" />
            Built for the lift, not the feed
          </p>

          <h1 className="display mt-8 animate-slide-up text-5xl font-bold uppercase leading-[0.88] text-[#f4f3ef] delay-50 sm:text-7xl lg:text-[6.5rem]">
            Train like
            <span className="block text-accent-red">it counts.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl animate-slide-up text-base leading-7 text-white/55 delay-150 sm:text-lg sm:leading-8">
            The gym tracker for lifters who want proof, not noise. Plan every session, log every
            set, catch every PR, and climb the ranks in one sharp loop.
          </p>

          <div className="mx-auto mt-9 grid max-w-[580px] animate-slide-up gap-3 delay-250">
            <Link
              to="/auth"
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-accent-red px-7 text-sm font-extrabold uppercase text-white shadow-[0_12px_36px_rgba(230,50,34,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#f13a2a]"
            >
              Get started free <ArrowRight className="ml-3" size={18} />
            </Link>
            <a
              href="#product"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/20 px-7 text-sm font-extrabold uppercase text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              See it in action
            </a>
          </div>

          <ul className="mx-auto mt-9 grid max-w-[500px] animate-slide-up grid-cols-2 gap-2 delay-350">
            {heroFeatures.map((feature) => (
              <li
                key={feature}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-[#0b0b0b] px-3 text-[11px] font-semibold text-white/55 sm:text-xs"
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-accent-red/70 text-accent-red">
                  <Check size={10} strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-float-in relative mx-auto mt-12 w-[300px] sm:mt-14 sm:w-[350px] lg:w-[390px]">
          <div
            className="absolute inset-x-10 top-6 h-3/4 rounded-[52px] shadow-[0_0_90px_rgba(230,50,34,0.18)]"
            aria-hidden="true"
          />
          <div className="relative rounded-[48px] border border-white/14 bg-[#1b1b1d] p-[9px] shadow-[0_36px_90px_rgba(0,0,0,0.68)] sm:rounded-[56px] sm:p-[11px]">
            <div className="overflow-hidden rounded-[40px] bg-black sm:rounded-[46px]">
              <img
                src="/screenshots/train.webp"
                alt="DEADSET dashboard showing the training schedule, readiness, nutrition and progress"
                className="block h-auto w-full"
                fetchPriority="high"
                width={620}
                height={1347}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    number: "01",
    title: "Plan the week",
    body: "Choose your training days, exercises, sets, and rep targets.",
  },
  {
    number: "02",
    title: "Log the work",
    body: "Record sets quickly while your session stays on track.",
  },
  {
    number: "03",
    title: "Review progress",
    body: "See PRs, consistency, nutrition, recovery, and rank movement.",
  },
];

function Flow() {
  return (
    <section className="bg-[#efeee9] text-[#111]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase text-[#777]">How it works</p>
            <h2 className="display mt-3 text-4xl font-bold uppercase leading-none sm:text-5xl">
              Plan. Train. Review.
            </h2>
          </div>
          <ol className="grid border-t border-black/20 sm:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="border-b border-black/20 py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0"
              >
                <p className="font-mono text-xs font-bold text-[#d82b1d]">{step.number}</p>
                <h3 className="mt-5 text-base font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/60">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

type ProductBandProps = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  imageAlt: string;
  light?: boolean;
  imageRight?: boolean;
};

function ProductBand({
  eyebrow,
  title,
  body,
  points,
  image,
  imageAlt,
  light = false,
  imageRight = false,
}: ProductBandProps) {
  const foreground = light ? "text-[#111]" : "text-[#f4f3ef]";
  const muted = light ? "text-black/60" : "text-white/58";

  return (
    <section className={light ? "bg-[#efeee9]" : "bg-[#0b0b0b]"}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-24">
        <div className={imageRight ? "lg:order-2" : ""}>
          <div className="mx-auto w-full max-w-[320px] lg:max-w-[390px]">
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              width={620}
              height={1347}
              className={`w-full rounded-[42px] border shadow-[0_35px_90px_rgba(0,0,0,0.35)] ${
                light ? "border-black/15" : "border-white/15"
              }`}
            />
          </div>
        </div>
        <div className={imageRight ? "lg:order-1" : ""}>
          <p
            className={`text-xs font-bold uppercase ${light ? "text-[#d82b1d]" : "text-accent-red"}`}
          >
            {eyebrow}
          </p>
          <h2
            className={`display mt-4 max-w-[11ch] text-5xl font-bold uppercase leading-[0.9] sm:text-6xl ${foreground}`}
          >
            {title}
          </h2>
          <p className={`mt-6 max-w-lg text-base leading-7 ${muted}`}>{body}</p>
          <ul className={`mt-8 border-t ${light ? "border-black/20" : "border-white/15"}`}>
            {points.map((point) => (
              <li
                key={point}
                className={`flex min-h-14 items-center gap-3 border-b text-sm font-semibold ${
                  light ? "border-black/20 text-black/80" : "border-white/15 text-white/80"
                }`}
              >
                <Check size={16} className="shrink-0 text-accent-red" strokeWidth={3} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const featureGroups = [
  {
    Icon: CalendarDays,
    label: "Planning",
    items: [
      "Weekly schedule builder",
      "Exercise catalogue",
      "Custom sets and reps",
      "Proven programs",
    ],
  },
  {
    Icon: Dumbbell,
    label: "Training",
    items: ["Fast set logging", "Automatic PR detection", "Warm-up ramps", "Plate calculator"],
  },
  {
    Icon: HeartPulse,
    label: "Health",
    items: [
      "Food and macro logging",
      "Apple Health and Watch",
      "Recovery tracking",
      "Progress photos",
    ],
  },
  {
    Icon: Trophy,
    label: "Community",
    items: ["Friends and activity", "Ranked leagues", "Challenges", "Shareable progress"],
  },
];

function FeatureIndex() {
  return (
    <section id="features" className="border-y border-white/10 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase text-accent-red">Included in DEADSET</p>
            <h2 className="display mt-3 text-4xl font-bold uppercase leading-none text-[#f4f3ef] sm:text-5xl">
              More depth.
              <span className="block text-white/40">Less clutter.</span>
            </h2>
          </div>
          <div className="border-t border-white/15">
            {featureGroups.map(({ Icon, label, items }) => (
              <div
                key={label}
                className="grid gap-4 border-b border-white/15 py-6 sm:grid-cols-[11rem_1fr] sm:items-start"
              >
                <div className="flex items-center gap-3 text-white">
                  <Icon size={18} className="text-accent-red" />
                  <h3 className="text-sm font-bold">{label}</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-white/55">
                  {items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const proHighlights = [
  { Icon: LineChart, text: "Advanced strength and training insights" },
  { Icon: HeartPulse, text: "Recovery and muscle-readiness tracking" },
  { Icon: Watch, text: "Deeper Apple Health and Watch views" },
  { Icon: ShieldCheck, text: "Streak protection and full history" },
  { Icon: Medal, text: "Full leagues, challenges, and badges" },
  { Icon: Cloud, text: "Unlimited custom programs and export" },
];

function Pricing() {
  const nativeIos = isNativeIos();
  const free = [
    "Workout planning and live set logging",
    "PR detection and progress tracking",
    "Food, water, and macro logging",
    "Friends, challenges, and leaderboards",
  ];

  return (
    <section id="pricing" className="bg-[#efeee9] text-[#111]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase text-[#d82b1d]">Plans</p>
          <h2 className="display mt-3 text-5xl font-bold uppercase leading-[0.9] sm:text-6xl">
            Start free.
            <span className="block text-black/35">Upgrade for depth.</span>
          </h2>
          <p className="mt-5 max-w-xl leading-7 text-black/60">
            The core training experience is free. Pro adds deeper analysis, recovery tools, and more
            control when you need them.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col rounded-lg border border-black/20 bg-[#f7f6f2] p-6 sm:p-8">
            <p className="text-sm font-bold">Free</p>
            <p className="display mt-3 text-5xl font-bold">£0</p>
            <p className="mt-2 text-sm text-black/50">No card required</p>
            <ul className="mt-8 flex-1 space-y-4">
              {free.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-black/65">
                  <Check size={17} className="shrink-0 text-[#d82b1d]" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg border border-black/25 px-5 text-sm font-bold hover:bg-black/5"
            >
              Start free
            </Link>
          </div>

          <div className="flex flex-col rounded-lg border border-[#9b7312] bg-[#12110e] p-6 text-white sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#f0c85a]">DEADSET Pro</p>
                {nativeIos ? (
                  <p className="display mt-3 text-4xl font-bold">Coming soon</p>
                ) : (
                  <>
                    <p className="display mt-3 text-5xl font-bold">
                      £4.99
                      <span className="ml-2 font-sans text-sm font-semibold text-white/45">
                        / month
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-white/55">£39.99 annually</p>
                  </>
                )}
              </div>
              <Zap size={24} className="text-[#f0c85a]" />
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {proHighlights.map(({ Icon, text }) => (
                <div key={text} className="flex gap-3 border-t border-white/15 pt-4">
                  <Icon size={17} className="shrink-0 text-[#f0c85a]" />
                  <p className="text-sm leading-5 text-white/70">{text}</p>
                </div>
              ))}
            </div>
            <Link
              to="/auth"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#f0c85a] px-5 text-sm font-bold text-[#17130a] hover:bg-[#f6d676]"
            >
              {nativeIos ? "Start training" : "Try Pro"}
            </Link>
          </div>
        </div>

        {!nativeIos && (
          <p className="mt-5 text-xs text-black/60">
            Prices shown in GBP. Local currency is applied at checkout. Cancel any time.
          </p>
        )}
      </div>
    </section>
  );
}

const faqs = [
  {
    question: "Can I build my own weekly schedule?",
    answer:
      "Yes. Choose each training day, add exercises from the catalogue, and set the sets and rep targets before you train. You can edit the schedule at any time.",
  },
  {
    question: "Is DEADSET free?",
    answer:
      "Yes. Planning, workout logging, PR tracking, nutrition, progress, and community basics are available free. Pro adds deeper analysis and advanced tools.",
  },
  {
    question: "Does it work with Apple Health and Apple Watch?",
    answer:
      "DEADSET can connect to Apple Health to bring steps, activity, energy, and workout context into your dashboard. Watch data is read through Apple Health.",
  },
  {
    question: "Will my workouts sync across devices?",
    answer:
      "Yes. When you are signed in, your account data syncs across supported devices. Core workout logging is designed to remain dependable during a session.",
  },
  {
    question: "Can I export or delete my data?",
    answer:
      "Yes. Account controls include data export and account deletion. Your training history remains yours.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#0b0b0b]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-xs font-bold uppercase text-accent-red">Questions</p>
          <h2 className="display mt-3 text-5xl font-bold uppercase leading-none text-[#f4f3ef]">
            Before you start.
          </h2>
          <p className="mt-5 max-w-sm leading-7 text-white/50">
            Need something else? Email{" "}
            <a
              className="text-white underline underline-offset-4"
              href="mailto:support@deadsetfit.org"
            >
              support@deadsetfit.org
            </a>
            .
          </p>
        </div>
        <div className="border-t border-white/15">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-white/15">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex min-h-16 w-full items-center justify-between gap-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold text-white">{item.question}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="max-w-2xl pb-6 text-sm leading-6 text-white/50">{item.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingCallToAction() {
  return (
    <section className="border-y border-white/10 bg-accent-red">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-black/55">Your next session</p>
          <h2 className="display mt-3 max-w-[10ch] text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl">
            Know what you are doing before you arrive.
          </h2>
        </div>
        <Link
          to="/auth"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-white px-6 text-sm font-bold text-black hover:bg-[#efeee9]"
        >
          Create free account <ArrowRight className="ml-2" size={17} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#080808]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45 md:ml-auto">
          <Link className="inline-flex min-h-11 items-center hover:text-white" to="/terms">
            Terms
          </Link>
          <Link className="inline-flex min-h-11 items-center hover:text-white" to="/privacy">
            Privacy
          </Link>
          <Link className="inline-flex min-h-11 items-center hover:text-white" to="/disclaimer">
            Disclaimer
          </Link>
          <a
            className="inline-flex min-h-11 items-center hover:text-white"
            href="mailto:support@deadsetfit.org"
          >
            Support
          </a>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} DEADSET</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Header />
      <main>
        <Hero />
        <Flow />
        <div id="product">
          <ProductBand
            eyebrow="Your schedule"
            title="Know what today looks like."
            body="See the whole week at a glance, then open today and start. Every session can be built around the exercises, sets, and rep ranges you actually want to do."
            points={[
              "Create and edit every training day",
              "Choose exercises from the full catalogue",
              "Set working sets and rep targets in advance",
            ]}
            image="/screenshots/train.webp"
            imageAlt="DEADSET weekly training schedule"
            imageRight
          />
          <ProductBand
            eyebrow="During training"
            title="Logging that keeps up."
            body="The live workout screen stays focused on the set in front of you. Previous numbers are close by, completed work is obvious, and new PRs are detected automatically."
            points={[
              "One-tap set completion",
              "Previous performance and targets together",
              "Automatic personal-record detection",
            ]}
            image="/screenshots/logger.webp"
            imageAlt="DEADSET live workout logger"
            light
          />
          <ProductBand
            eyebrow="After training"
            title="Progress you can read."
            body="Your lifts, consistency, body data, nutrition, and competition history come together in one profile. No separate spreadsheet and no guessing what changed."
            points={[
              "Strength trends and lifetime records",
              "Progress photos and body measurements",
              "Ranks, leagues, and shareable milestones",
            ]}
            image="/screenshots/profile.webp"
            imageAlt="DEADSET progress profile and ranked league"
            imageRight
          />
        </div>
        <FeatureIndex />
        <Pricing />
        <FAQ />
        <ClosingCallToAction />
      </main>
      <Footer />
    </div>
  );
}
