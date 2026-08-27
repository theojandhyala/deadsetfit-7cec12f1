import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { trackWhopEvent } from "@/lib/whop";
import {
  Activity,
  Apple,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  HeartPulse,
  Medal,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
  Watch,
  Zap,
} from "lucide-react";

export const DEADSET_APP_STORE_URL = "https://apps.apple.com/app/deadset/id6783511541";

const APP_STORE_BADGE_URL =
  "https://toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/en-gb?size=250x83";

const navigation = [
  { label: "Inside the app", href: "#experience" },
  { label: "Everything tracked", href: "#features" },
  { label: "DEADSET Pro", href: "#pro" },
];

function Logo({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`display whitespace-nowrap font-bold tracking-[0] ${large ? "text-4xl sm:text-5xl" : "text-xl"}`}
      aria-label="DEADSET"
    >
      <span className="text-[#f4f3ef]">DEAD</span>
      <span className="text-[#f13a2c]">SET</span>
    </span>
  );
}

function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={DEADSET_APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Download DEADSET on the App Store"
      onClick={() => trackWhopEvent("app_store_click")}
      className={`inline-flex min-h-14 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f13a2c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#070708] transition-transform hover:-translate-y-0.5 ${className}`}
    >
      <img
        src={APP_STORE_BADGE_URL}
        alt="Download on the App Store"
        width={250}
        height={83}
        className="h-[60px] w-auto sm:h-[64px]"
      />
    </a>
  );
}

function StoreButton({ label = "Download DEADSET" }: { label?: string }) {
  return (
    <a
      href={DEADSET_APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackWhopEvent("app_store_click")}
      className="inline-flex min-h-13 items-center justify-center gap-3 rounded-lg bg-[#f13a2c] px-5 text-sm font-extrabold text-white shadow-[0_14px_35px_rgba(241,58,44,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ff493a]"
    >
      <Apple size={18} fill="currentColor" aria-hidden="true" />
      {label}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070708]/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-6 px-5 sm:px-8 lg:px-12">
        <a href="#top" className="inline-flex min-h-11 items-center" aria-label="DEADSET home">
          <Logo />
        </a>

        <nav className="ml-auto hidden items-center gap-8 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-white/58 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href={DEADSET_APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackWhopEvent("app_store_click")}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:bg-[#f4f3ef] lg:ml-2"
        >
          <Apple size={17} fill="currentColor" aria-hidden="true" />
          <span className="hidden sm:inline">View on App Store</span>
          <span className="sm:hidden">App Store</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

function Phone({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`landing-phone ${className}`}>
      <div className="landing-phone-screen">
        <img
          src={src}
          alt={alt}
          width={620}
          height={1347}
          className="block h-auto w-full"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </div>
    </div>
  );
}

export type LandingCampaign = "default" | "stop-guessing" | "real-week";

const campaignCopy: Record<LandingCampaign, { eyebrow: string; headline: string; body: string }> = {
  default: {
    eyebrow: "Built for the lift, not the feed",
    headline: "Train like it counts.",
    body: "Plan your week, log every set, and see what is actually improving.",
  },
  "stop-guessing": {
    eyebrow: "A clear answer before you walk in",
    headline: "Stop guessing what to train.",
    body: "Tell DEADSET your goal and training days. Open the gym with a plan, clear set targets, and a session ready to log.",
  },
  "real-week": {
    eyebrow: "A programme that fits real life",
    headline: "Your real week. A plan that fits.",
    body: "Choose the days you can actually train. DEADSET turns them into a balanced week that is ready when you are.",
  },
};

function Hero({ campaign }: { campaign: LandingCampaign }) {
  const copy = campaignCopy[campaign];
  return (
    <section id="top" className="landing-hero relative overflow-hidden border-b border-white/10">
      <div className="landing-hero-lines absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-[1440px] items-start gap-12 px-5 pb-0 pt-[108px] sm:px-8 sm:pt-[124px] lg:min-h-[820px] lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)] lg:items-center lg:gap-20 lg:px-12 lg:pb-28 lg:pt-32">
        <div className="relative z-20 max-w-2xl animate-slide-up">
          <div className="mb-6 inline-flex min-h-9 items-center gap-3 border-l-2 border-[#f13a2c] bg-black/35 px-3 text-[11px] font-bold uppercase text-white/68 backdrop-blur-sm sm:mb-7 sm:min-h-10 sm:px-4 sm:text-xs">
            <span className="h-2 w-2 bg-[#f13a2c] shadow-[0_0_18px_rgba(241,58,44,0.9)]" />
            {copy.eyebrow}
          </div>

          <h1 className="display text-[clamp(3.1rem,16vw,4.1rem)] font-bold uppercase leading-[0.82] tracking-[0] text-[#f4f3ef] sm:text-8xl lg:text-[7.8rem]">
            Dead<span className="text-[#f13a2c]">set</span>
          </h1>
          <p className="display mt-5 max-w-[12ch] text-[2.15rem] font-bold uppercase leading-[0.94] tracking-[0] text-white sm:mt-6 sm:text-6xl">
            {copy.headline}
          </p>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/62 sm:mt-7 sm:max-w-xl sm:text-lg sm:leading-8">
            {copy.body}
          </p>

          <div className="mt-8 flex max-w-md flex-col items-start gap-4 border-t border-white/12 pt-6 sm:mt-9 sm:flex-row sm:items-center sm:gap-6">
            <AppStoreBadge className="shrink-0 shadow-[0_18px_45px_rgba(0,0,0,0.32)]" />
            <div>
              <p className="text-sm font-extrabold text-white">Available now on the App Store</p>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Free to start · Built for iPhone
              </p>
            </div>
          </div>
        </div>

        <div className="landing-device-stage pointer-events-none relative z-10 h-[360px] overflow-hidden sm:h-[480px] lg:h-[650px] lg:overflow-visible">
          <Phone
            src="/screenshots/logger.webp"
            alt="DEADSET live workout logger"
            className="landing-phone-left hidden lg:block"
          />
          <Phone
            src="/screenshots/profile.webp"
            alt="DEADSET progress and ranked profile"
            className="landing-phone-right hidden lg:block"
          />
          <Phone
            src="/screenshots/train.webp"
            alt="DEADSET training dashboard"
            className="landing-phone-main"
            priority
          />
        </div>
      </div>

      <div className="relative z-30 hidden border-t border-white/12 bg-[#070708]/92 backdrop-blur-lg sm:block">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8 lg:px-12">
          {[
            ["01", "Plan the week"],
            ["02", "Log every set"],
            ["03", "Track the proof"],
            ["04", "Climb the ranks"],
          ].map(([number, label]) => (
            <div
              key={number}
              className="flex min-h-16 items-center gap-3 border-r border-white/10 px-3 first:pl-0 last:border-r-0 sm:min-h-20 sm:px-5"
            >
              <span className="font-mono text-[10px] font-bold text-[#f13a2c]">{number}</span>
              <span className="text-xs font-bold text-white/68 sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const systemWords = ["Plan", "Train", "Recover", "Compete", "Progress", "Repeat"];

function SystemTicker() {
  return (
    <div
      className="overflow-hidden border-b border-black/20 bg-[#f4f3ef] text-black"
      aria-label="Plan, train, recover, compete, progress, repeat"
    >
      <div className="landing-ticker-track flex min-h-14 w-max items-center gap-9 px-5">
        {[...systemWords, ...systemWords].map((word, index) => (
          <span
            key={`${word}-${index}`}
            className="flex items-center gap-9"
            aria-hidden={index >= systemWords.length}
          >
            <span className="display text-sm font-bold uppercase tracking-[0]">{word}</span>
            <span className="h-1.5 w-1.5 bg-[#f13a2c]" />
          </span>
        ))}
      </div>
    </div>
  );
}

const productViews = [
  {
    id: "plan",
    label: "Plan",
    eyebrow: "Before the gym",
    title: "The whole week, already decided.",
    body: "Choose each training day, add the exercises you actually want, and set working sets and rep targets before the session starts.",
    image: "/screenshots/train.webp",
    alt: "DEADSET weekly schedule and training dashboard",
    facts: ["Every day editable", "Exercise catalogue", "Sets and reps built in"],
  },
  {
    id: "train",
    label: "Train",
    eyebrow: "During the session",
    title: "Fast enough for the set in front of you.",
    body: "Previous numbers, today’s targets, rest timing, and completed work stay close without turning the workout into admin.",
    image: "/screenshots/logger.webp",
    alt: "DEADSET live set logger",
    facts: ["One-tap completion", "Live exercise swaps", "Automatic PR detection"],
  },
  {
    id: "progress",
    label: "Progress",
    eyebrow: "After the work",
    title: "Proof that your training is moving.",
    body: "Strength, consistency, nutrition, body data, and competitive rank come together in one place you can read at a glance.",
    image: "/screenshots/profile.webp",
    alt: "DEADSET athlete profile and ranked division",
    facts: ["Strength records", "Ranked leagues", "Shareable milestones"],
  },
] as const;

function ProductExperience() {
  const [activeView, setActiveView] = useState<(typeof productViews)[number]["id"]>("plan");
  const active = productViews.find((view) => view.id === activeView) ?? productViews[0];

  return (
    <section id="experience" className="bg-[#0a0a0b] text-white">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        <div className="flex flex-col gap-8 border-b border-white/12 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#f13a2c]">
              One connected training loop
            </p>
            <h2 className="display mt-4 max-w-[12ch] text-5xl font-bold uppercase leading-[0.9] tracking-[0] text-[#f4f3ef] sm:text-7xl">
              Everything where you expect it.
            </h2>
          </div>
          <p className="max-w-lg text-base leading-7 text-white/52">
            No maze of dashboards. DEADSET follows the same order your training does: decide the
            work, do the work, then understand what changed.
          </p>
        </div>

        <div className="mt-14 grid gap-16 sm:mt-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(480px,1.18fr)] lg:items-center lg:gap-24">
          <div>
            <div
              className="inline-grid grid-cols-3 rounded-lg border border-white/14 bg-white/[0.035] p-1"
              role="tablist"
              aria-label="DEADSET product views"
            >
              {productViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  role="tab"
                  aria-selected={activeView === view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`min-h-11 rounded-md px-5 text-sm font-bold transition sm:px-7 ${
                    activeView === view.id
                      ? "bg-[#f13a2c] text-white shadow-[0_8px_24px_rgba(241,58,44,0.2)]"
                      : "text-white/48 hover:text-white"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            <div className="mt-10" key={active.id}>
              <p className="text-xs font-bold uppercase text-[#f13a2c]">{active.eyebrow}</p>
              <h3 className="display mt-4 max-w-[12ch] text-4xl font-bold uppercase leading-[0.92] tracking-[0] text-[#f4f3ef] sm:text-6xl">
                {active.title}
              </h3>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/56">{active.body}</p>
              <ul className="mt-8 border-t border-white/12">
                {active.facts.map((fact) => (
                  <li
                    key={fact}
                    className="flex min-h-14 items-center gap-3 border-b border-white/12 text-sm font-semibold text-white/76"
                  >
                    <Check
                      size={16}
                      className="text-[#f13a2c]"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="landing-console relative min-h-[590px] overflow-hidden border border-white/12 bg-[#101012] sm:min-h-[700px]">
            <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between border-b border-white/10 px-4">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-white/42">
                <span className="h-1.5 w-1.5 bg-[#f13a2c]" /> Live product view
              </span>
              <span className="font-mono text-[10px] text-white/30">DEADSET / {active.id}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-12 grid place-items-center overflow-hidden px-8 pt-10 sm:px-14">
              <Phone
                src={active.image}
                alt={active.alt}
                className="landing-console-phone animate-float-in"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const capabilityGroups = [
  {
    Icon: CalendarDays,
    number: "01",
    title: "Programming",
    body: "Build custom weeks, choose exercises, set reps, swap movements, or start from proven programs.",
    items: ["Weekly schedule", "Exercise catalogue", "Custom sets and reps"],
  },
  {
    Icon: Dumbbell,
    number: "02",
    title: "Training",
    body: "Log fast, keep previous performance close, detect PRs, and stay on pace through the session.",
    items: ["Live logging", "Rest timer", "Warm-ups and supersets"],
  },
  {
    Icon: Utensils,
    number: "03",
    title: "Nutrition",
    body: "Keep calories, macros, water, bodyweight, and measured maintenance alongside the training they support.",
    items: ["Food and macros", "Adaptive targets", "Hydration"],
  },
  {
    Icon: Watch,
    number: "04",
    title: "Apple Fitness",
    body: "Bring steps, activity, energy, and Apple Watch workout context into your daily view through Apple Health.",
    items: ["Apple Health", "Watch context", "Recovery signals"],
  },
  {
    Icon: Users,
    number: "05",
    title: "Competition",
    body: "Add friends, take on challenges, move through ranked divisions, and share milestones worth showing.",
    items: ["Friends", "Challenges", "Ranked leagues"],
  },
  {
    Icon: BarChart3,
    number: "06",
    title: "Progress",
    body: "See strength trends, session records, lifetime tonnage, body changes, and the rhythm of your training.",
    items: ["Strength trends", "Progress photos", "Lifetime records"],
  },
];

function Capabilities() {
  return (
    <section id="features" className="bg-[#efeee9] text-[#111]">
      <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        <div className="grid gap-8 border-b border-black/18 pb-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-[#cf2d20]">The full system</p>
            <h2 className="display mt-4 max-w-[11ch] text-5xl font-bold uppercase leading-[0.9] tracking-[0] sm:text-7xl">
              Deep, without feeling complicated.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-black/58 lg:justify-self-end">
            The important things stay visible. The advanced tools are there when you need them. You
            can start a workout in seconds without giving up long-term depth.
          </p>
        </div>

        <div className="grid lg:grid-cols-2">
          {capabilityGroups.map(({ Icon, number, title, body, items }, index) => (
            <article
              key={title}
              className={`border-b border-black/18 py-9 lg:min-h-[270px] lg:px-9 ${
                index % 2 === 0 ? "lg:border-r lg:pl-0" : "lg:pr-0"
              }`}
            >
              <div className="flex items-start gap-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center border border-black/22 bg-white/45 text-[#cf2d20]">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="display text-3xl font-bold uppercase tracking-[0]">{title}</h3>
                    <span className="font-mono text-[10px] font-bold text-black/35">{number}</span>
                  </div>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-black/60">{body}</p>
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="flex items-center gap-2 text-xs font-bold text-black/68"
                      >
                        <span className="h-1.5 w-1.5 bg-[#cf2d20]" /> {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const proFeatures = [
  { Icon: Activity, text: "Advanced strength and training analysis" },
  { Icon: HeartPulse, text: "Muscle readiness and recovery views" },
  { Icon: Watch, text: "Deeper Apple Health and Watch context" },
  { Icon: ShieldCheck, text: "Streak protection and complete history" },
  { Icon: Medal, text: "Full ranked leagues, challenges, and badges" },
  { Icon: Sparkles, text: "Unlimited programs, insights, and export" },
];

function Pro() {
  return (
    <section
      id="pro"
      className="relative overflow-hidden border-y border-[#d9ab35]/35 bg-[#0c0c0d] text-white"
    >
      <div
        className="landing-pro-mark absolute right-[-30px] top-[-35px] select-none text-[12rem] font-black uppercase text-white/[0.025] sm:text-[18rem] lg:text-[24rem]"
        aria-hidden="true"
      >
        Pro
      </div>
      <div className="relative mx-auto grid max-w-[1440px] gap-16 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.82fr_1.18fr] lg:gap-24 lg:px-12 lg:py-40">
        <div>
          <div className="inline-flex items-center gap-2 border border-[#d9ab35]/45 bg-[#d9ab35]/8 px-3 py-2 text-xs font-bold text-[#f0c85a]">
            <Zap size={14} fill="currentColor" aria-hidden="true" /> DEADSET Pro
          </div>
          <h2 className="display mt-7 max-w-[10ch] text-5xl font-bold uppercase leading-[0.88] tracking-[0] text-[#f4f3ef] sm:text-7xl">
            Turn your history into an advantage.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/55">
            Free handles the workout. Pro goes deeper across recovery, trends, competition, and the
            long view of your training.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <StoreButton label="Start free on iPhone" />
            <span className="text-xs text-white/40">
              Upgrade inside the app · Cancel through Apple
            </span>
          </div>
        </div>

        <div className="grid gap-px border border-white/12 bg-white/12 sm:grid-cols-2">
          {proFeatures.map(({ Icon, text }) => (
            <div key={text} className="flex min-h-32 gap-4 bg-[#111113] p-6 sm:p-7">
              <Icon size={20} className="shrink-0 text-[#f0c85a]" aria-hidden="true" />
              <p className="text-sm font-semibold leading-6 text-white/72">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    question: "Can I build my entire weekly schedule?",
    answer:
      "Yes. Choose each training day, add exercises from the catalogue, and set sets and rep targets before you train. You can edit any day later.",
  },
  {
    question: "Is DEADSET free to use?",
    answer:
      "Yes. The core planning, workout logging, PR tracking, nutrition, progress, and community experience is free. Pro adds deeper analysis and advanced tools.",
  },
  {
    question: "Does it connect to Apple Health and Apple Watch?",
    answer:
      "DEADSET can read supported steps, activity, energy, and workout data through Apple Health. Apple Watch context arrives through the same private Health connection.",
  },
  {
    question: "Can I export or delete my data?",
    answer:
      "Yes. Settings include data export and permanent account deletion. Your training history remains under your control.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#080809] text-white">
      <div className="mx-auto grid max-w-[1440px] gap-16 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24 lg:px-12 lg:py-40">
        <div>
          <p className="text-xs font-bold uppercase text-[#f13a2c]">Before you download</p>
          <h2 className="display mt-4 text-5xl font-bold uppercase leading-[0.9] tracking-[0] text-[#f4f3ef] sm:text-7xl">
            Straight answers.
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-white/48">
            Need anything else?{" "}
            <a
              href="mailto:support@deadsetfit.org"
              className="text-white underline underline-offset-4"
            >
              support@deadsetfit.org
            </a>
          </p>
        </div>

        <div className="border-t border-white/14">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-white/14">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex min-h-20 w-full items-center justify-between gap-5 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-white">{item.question}</span>
                  <ChevronDown
                    size={19}
                    className={`shrink-0 text-white/45 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <p className="max-w-2xl pb-7 text-sm leading-6 text-white/52">{item.answer}</p>
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
    <section className="relative overflow-hidden bg-[#f13a2c] text-white">
      <div
        className="absolute inset-y-0 right-0 hidden w-2/5 border-l border-black/12 lg:block"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-end lg:justify-between lg:px-12">
        <div>
          <div className="flex items-center gap-3 text-xs font-bold uppercase text-black/55">
            <Flame size={16} fill="currentColor" aria-hidden="true" /> Your next session starts here
          </div>
          <h2 className="display mt-5 max-w-[12ch] text-5xl font-bold uppercase leading-[0.88] tracking-[0] sm:text-7xl">
            Stop guessing. Start building proof.
          </h2>
        </div>
        <a
          href={DEADSET_APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackWhopEvent("app_store_click")}
          className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-lg bg-white px-6 text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:bg-[#f4f3ef]"
        >
          <Apple size={19} fill="currentColor" aria-hidden="true" /> Download DEADSET
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#070708] text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center lg:px-12">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/42 md:ml-auto">
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
          <a
            className="inline-flex min-h-11 items-center gap-1 hover:text-white"
            href={DEADSET_APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhopEvent("app_store_click")}
          >
            App Store <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
        <p className="text-xs text-white/38">© {new Date().getFullYear()} DEADSET</p>
      </div>
    </footer>
  );
}

export function Landing({ campaign = "default" }: { campaign?: LandingCampaign }) {
  return (
    <div className="deadset-landing min-h-screen bg-[#070708] text-white">
      <Header />
      <main>
        <Hero campaign={campaign} />
        <SystemTicker />
        <ProductExperience />
        <Capabilities />
        <Pro />
        <FAQ />
        <ClosingCallToAction />
      </main>
      <Footer />
    </div>
  );
}
