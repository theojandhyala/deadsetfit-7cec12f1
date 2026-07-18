import { Flame, Trophy, Crown, Dumbbell, Check, ChevronLeft } from "lucide-react";

/** A realistic iPhone frame. Wrap any "screen" content — it clips to the
 *  rounded display and sits in a dark bezel with an ambient red glow. */
export function PhoneFrame({
  children,
  image,
  alt = "DEADSET app screen",
  className = "",
  glow = true,
}: {
  children?: React.ReactNode;
  /** A real app screenshot; when set it fills the screen and the drawn notch is hidden. */
  image?: string;
  alt?: string;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div
          className="absolute -inset-8 rounded-[60px] blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(225,6,0,0.22), transparent 70%)" }}
          aria-hidden="true"
        />
      )}
      <div
        className="relative mx-auto w-[270px] rounded-[46px] p-[10px] sm:w-[300px]"
        style={{
          background: "linear-gradient(160deg, #2a2a2c, #0c0c0d)",
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.12), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[38px]"
          style={{ background: "#0A0A0A", aspectRatio: "9 / 19.3" }}
        >
          {image ? (
            <img src={image} alt={alt} loading="lazy" className="h-full w-full object-cover object-top" />
          ) : (
            <>
              <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="h-full overflow-hidden">{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[9px] font-bold text-grit">
      <span>9:41</span>
      <span className="label-cap text-[8px] text-grit-dim">{label}</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-3.5 rounded-sm border border-grit/60" />
      </span>
    </div>
  );
}

/** TRAIN — today's plan + week strip + start button. */
export function TrainScreen() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <StatusBar label="Train" />
      <div className="px-4 pt-2">
        <p className="label-cap text-[8px] text-accent-red">Wednesday · Push day</p>
        <h3 className="display text-2xl font-extrabold uppercase leading-none text-white">Today&apos;s Mission</h3>
        <div className="mt-3 flex gap-1.5">
          {days.map((d, i) => (
            <div
              key={i}
              className={`flex h-9 flex-1 flex-col items-center justify-center rounded-lg border text-[9px] font-bold ${
                i === 2
                  ? "border-accent-red bg-accent-red/15 text-white"
                  : i < 2
                    ? "border-grit/20 bg-grit-card text-grit-dim"
                    : "border-grit/10 bg-black/40 text-grit-dim/60"
              }`}
            >
              {d}
              {i < 3 && <Check size={9} className={i === 2 ? "text-accent-red" : "text-grit-dim"} />}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-grit/15 bg-grit-card p-3">
          <p className="label-cap text-[7px] text-grit-dim">The plan</p>
          {["Bench Press", "Incline DB Press", "Overhead Press", "Cable Fly"].map((ex, i) => (
            <div key={ex} className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-grit">{ex}</span>
              <span className="text-[9px] text-grit-dim">{[4, 3, 3, 3][i]} × {[6, 10, 8, 12][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto p-4">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent-red py-3 text-xs font-extrabold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(225,6,0,0.4)]">
          <Dumbbell size={14} /> Start workout
        </div>
      </div>
    </div>
  );
}

/** LIVE LOGGER — sets ticking, a PR flame. */
export function LoggerScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <StatusBar label="Live · 32:15" />
      <div className="flex items-center justify-between px-4 pt-2">
        <div>
          <p className="label-cap text-[8px] text-accent-red">Push day · Exercise 1/4</p>
          <h3 className="display text-2xl font-extrabold uppercase leading-none text-white">Bench Press</h3>
        </div>
      </div>
      <div className="mt-3 space-y-2 px-4">
        {[
          { s: 1, t: "80 kg × 8", pr: false },
          { s: 2, t: "80 kg × 8", pr: false },
          { s: 3, t: "82.5 kg × 6", pr: true },
        ].map((r) => (
          <div
            key={r.s}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
              r.pr ? "border-accent-red/50 bg-accent-red/10" : "border-grit/15 bg-grit-card"
            }`}
          >
            <span className="label-cap text-[8px] text-grit-dim">Set {r.s}</span>
            <span className="flex items-center gap-1.5 text-sm font-extrabold text-grit">
              {r.t}
              {r.pr && <Flame size={13} className="text-accent-red" />}
            </span>
          </div>
        ))}
      </div>
      <div className="mx-4 mt-3 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-cap text-[7px] text-accent-red">New PR detected</p>
            <p className="text-[10px] font-bold text-grit">82.5kg beats your 80kg best</p>
          </div>
          <Trophy size={16} className="text-accent-red" />
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 p-4">
        <div className="rounded-xl border border-grit/20 py-2.5 text-center text-[10px] font-bold uppercase text-grit-dim">Next</div>
        <div className="rounded-xl bg-accent-red py-2.5 text-center text-[10px] font-extrabold uppercase text-white">Log set</div>
      </div>
    </div>
  );
}

/** CATALOGUE — before/after + a PR wall row. */
export function CatalogueScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <StatusBar label="Journey" />
      <div className="px-4 pt-2">
        <p className="label-cap text-[8px] text-accent-red">The catalogue</p>
        <h3 className="display text-2xl font-extrabold uppercase leading-none text-white">Your Journey</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { tag: "BEFORE", from: "#3a2a2a", to: "#1a1414" },
            { tag: "NOW", from: "#4a2020", to: "#241010" },
          ].map((p) => (
            <div key={p.tag} className="relative overflow-hidden rounded-lg" style={{ aspectRatio: "3/4", background: `linear-gradient(160deg, ${p.from}, ${p.to})` }}>
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[7px] font-bold text-white">{p.tag}</span>
              <Dumbbell size={22} className="absolute inset-0 m-auto text-white/10" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[8px] font-bold uppercase tracking-widest text-accent-red">12 weeks of forging</p>
        <div className="mt-3 space-y-2">
          {[
            { n: "Bench Press", v: 82.5 },
            { n: "Squat", v: 140 },
            { n: "Deadlift", v: 180 },
          ].map((l) => (
            <div key={l.n} className="flex items-center justify-between rounded-xl border border-grit/15 bg-grit-card px-3 py-2.5">
              <span className="text-[11px] font-extrabold uppercase text-white">{l.n}</span>
              <div className="flex items-center gap-2">
                <svg width="40" height="16" aria-hidden>
                  <polyline points="2,13 12,10 22,7 38,3" fill="none" stroke="#E10600" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-base font-extrabold text-accent-red">{l.v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** RANK — leaderboard with the user climbing. */
export function RankScreen() {
  const rows = [
    { r: 1, name: "IRONMIKE", pts: 980, tier: "ELITE", me: false },
    { r: 2, name: "YOU", pts: 872, tier: "GOLD", me: true },
    { r: 3, name: "LIFTQUEEN", pts: 861, tier: "GOLD", me: false },
    { r: 4, name: "REPKING", pts: 790, tier: "SILVER", me: false },
    { r: 5, name: "GRINDSET", pts: 744, tier: "SILVER", me: false },
  ];
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <StatusBar label="Leagues" />
      <div className="px-4 pt-2">
        <p className="label-cap text-[8px] text-accent-red">Gold division · Week 3</p>
        <h3 className="display text-2xl font-extrabold uppercase leading-none text-white">Rank Up</h3>
        <div className="mt-3 rounded-2xl border border-accent-red/40 bg-accent-red/10 p-3 text-center">
          <Crown size={18} className="mx-auto text-accent-red" />
          <p className="mt-1 text-[10px] text-grit">
            <span className="font-extrabold text-white">1 more session</span> to promote
          </p>
        </div>
        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.r}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                row.me ? "border-accent-red/50 bg-accent-red/10" : "border-grit/12 bg-grit-card"
              }`}
            >
              <span className={`display text-sm font-extrabold ${row.me ? "text-accent-red" : "text-grit-dim"}`}>{row.r}</span>
              <span className={`flex-1 text-[11px] font-bold ${row.me ? "text-white" : "text-grit"}`}>{row.name}</span>
              <span className="label-cap text-[7px] text-grit-dim">{row.tier}</span>
              <span className="text-[11px] font-extrabold text-grit">{row.pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A compact back-nav header used decoratively on some screens. */
export function ScreenBack() {
  return (
    <div className="flex items-center gap-2 px-4 pt-2 text-grit-dim">
      <ChevronLeft size={16} />
    </div>
  );
}
