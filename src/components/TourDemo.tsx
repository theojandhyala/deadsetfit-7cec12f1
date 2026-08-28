import { MuscleDiagram } from "@/components/MuscleDiagram";

/**
 * A small, looping demonstration of one feature, for the tour.
 *
 * The tour was twelve slides of an icon and three bullet points, which is a
 * table of contents rather than a tutorial: you finish it knowing the app has
 * a Strength Map without having any idea what one looks like. Each slide now
 * shows the thing moving — a set landing, the map filling in, a rest timer
 * running — because a feature nobody can picture is a feature that stays
 * hidden whether or not it was listed.
 *
 * Everything here is CSS and SVG against real components. No screenshots to go
 * stale, and nothing that needs the athlete to have any data yet.
 */
export type DemoKind =
  | "week"
  | "logging"
  | "rest"
  | "strength"
  | "photos"
  | "nutrition"
  | "health"
  | "friends"
  | "library"
  | "membership";

const RED = "#e63222";

export function TourDemo({ kind }: { kind: DemoKind }) {
  return (
    <div className="tour-demo relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e10] p-4">
      {kind === "week" && <WeekDemo />}
      {kind === "logging" && <LoggingDemo />}
      {kind === "rest" && <RestDemo />}
      {kind === "strength" && <StrengthDemo />}
      {kind === "photos" && <PhotosDemo />}
      {kind === "nutrition" && <NutritionDemo />}
      {kind === "health" && <HealthDemo />}
      {kind === "friends" && <FriendsDemo />}
      {kind === "library" && <LibraryDemo />}
      {kind === "membership" && <MembershipDemo />}
    </div>
  );
}

/** The training week filling in, day by day. */
function WeekDemo() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const training = [true, false, true, true, false, true, false];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day, index) => (
        <div
          key={index}
          className="tour-stagger grid aspect-square place-items-center rounded-lg border text-[11px] font-black"
          style={{
            animationDelay: `${index * 110}ms`,
            borderColor: training[index] ? RED : "rgba(255,255,255,.09)",
            background: training[index] ? "rgba(230,50,34,.14)" : "#141518",
            color: training[index] ? "#fff" : "#5f6266",
          }}
        >
          {day}
        </div>
      ))}
    </div>
  );
}

/** Sets landing one after another, the way they do mid-workout. */
function LoggingDemo() {
  const sets = [
    { weight: "60", reps: "10" },
    { weight: "65", reps: "8" },
    { weight: "70", reps: "6" },
  ];
  return (
    <div className="space-y-1.5">
      {sets.map((set, index) => (
        <div
          key={index}
          className="tour-stagger flex items-center gap-2 rounded-lg border border-white/10 bg-[#141518] px-3 py-2"
          style={{ animationDelay: `${index * 420}ms` }}
        >
          <span className="label-cap w-8 text-[9px] text-grit-dim">SET {index + 1}</span>
          <span className="display text-sm font-extrabold text-grit">{set.weight}</span>
          <span className="text-[10px] text-grit-dim">×</span>
          <span className="display text-sm font-extrabold text-grit">{set.reps}</span>
          <span
            className="tour-tick ml-auto grid h-5 w-5 place-items-center rounded-full"
            style={{ background: RED, animationDelay: `${index * 420 + 260}ms` }}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth={4}>
              <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}

/** A rest ring draining, counting down against a deadline. */
function RestDemo() {
  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(230,50,34,.18)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={RED}
          strokeWidth="9"
          strokeLinecap="round"
          className="tour-ring"
        />
      </svg>
      <div>
        <p className="label-cap text-[9px] text-grit-dim">REST</p>
        <p className="display text-2xl font-extrabold tabular-nums text-grit">0:90</p>
        <p className="mt-0.5 text-[10px] leading-tight text-grit-dim">
          Counts down even with the
          <br />
          phone locked.
        </p>
      </div>
    </div>
  );
}

/** The real muscle map, filling with grades. */
function StrengthDemo() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="tour-fade" style={{ animationDelay: "0ms" }}>
        <MuscleDiagram view="front" size={140} />
        <p className="label-cap mt-1 text-center text-[8px] text-grit-dim">DAY ONE</p>
      </div>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-grit-dim" fill="currentColor">
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <div className="tour-fade" style={{ animationDelay: "700ms" }}>
        <MuscleDiagram
          view="front"
          size={140}
          gradeColors={{
            CHEST: "#3297e3",
            ARMS: "#45bd62",
            CORE: "#f59e0b",
            SHOULDERS: "#a43ac2",
            LEGS: "#ef4444",
          }}
        />
        <p className="label-cap mt-1 text-center text-[8px]" style={{ color: RED }}>
          AFTER 12 WEEKS
        </p>
      </div>
    </div>
  );
}

/** A before/after wipe, which is the whole pitch for check-ins. */
function PhotosDemo() {
  return (
    <div className="flex items-center justify-center gap-3">
      {[
        { label: "BEFORE", scale: 0.86, tone: "#2a3040" },
        { label: "NOW", scale: 1, tone: "#3a2422" },
      ].map((pane, index) => (
        <figure
          key={pane.label}
          className="tour-fade relative w-[86px] overflow-hidden rounded-xl"
          style={{ animationDelay: `${index * 600}ms`, background: pane.tone }}
        >
          <svg viewBox="0 0 90 120" className="block w-full">
            <g transform={`translate(45 66) scale(${pane.scale}) translate(-45 -66)`}>
              <ellipse cx="45" cy="30" rx="10" ry="12" fill="rgba(255,255,255,.16)" />
              <rect x="31" y="44" width="28" height="40" rx="9" fill="rgba(255,255,255,.16)" />
              <rect x="34" y="84" width="10" height="30" rx="5" fill="rgba(255,255,255,.13)" />
              <rect x="46" y="84" width="10" height="30" rx="5" fill="rgba(255,255,255,.13)" />
            </g>
          </svg>
          <figcaption className="label-cap absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[8px] text-grit">
            {pane.label}
          </figcaption>
        </figure>
      ))}
      <div className="min-w-0">
        <p className="display text-sm font-extrabold uppercase leading-tight text-grit">
          8 weeks apart
        </p>
        <p className="mt-1 text-[10px] leading-tight text-grit-dim">
          The mirror lies.
          <br />
          The camera doesn&apos;t.
        </p>
      </div>
    </div>
  );
}

/** Macro bars filling to target. */
function NutritionDemo() {
  const macros = [
    { label: "PROTEIN", pct: 82, color: RED },
    { label: "CARBS", pct: 64, color: "#f59e0b" },
    { label: "FAT", pct: 48, color: "#45bd62" },
  ];
  return (
    <div className="space-y-2.5">
      {macros.map((macro, index) => (
        <div key={macro.label}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="label-cap text-[9px] text-grit-dim">{macro.label}</span>
            <span className="display text-[10px] font-extrabold text-grit">{macro.pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1a1b1e]">
            <div
              className="tour-bar h-full rounded-full"
              style={
                {
                  background: macro.color,
                  animationDelay: `${index * 180}ms`,
                  "--tour-bar-to": `${macro.pct}%`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A heart-rate trace drawing itself. */
function HealthDemo() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 200 60" className="h-16 flex-1">
        <path
          d="M2 40 L28 40 L36 20 L46 52 L58 12 L68 40 L96 40 L110 40 L118 24 L128 50 L140 16 L150 40 L198 40"
          fill="none"
          stroke={RED}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tour-trace"
        />
      </svg>
      <div className="shrink-0">
        <p className="label-cap text-[9px] text-grit-dim">RESTING HR</p>
        <p className="display text-xl font-extrabold text-grit">54</p>
        <p className="text-[9px] text-grit-dim">from Apple Health</p>
      </div>
    </div>
  );
}

/** A leaderboard settling into place. */
function FriendsDemo() {
  const rows = [
    { name: "YOU", score: "1,240", you: true },
    { name: "SAM", score: "1,180", you: false },
    { name: "ALEX", score: "970", you: false },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div
          key={row.name}
          className="tour-stagger flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            animationDelay: `${index * 200}ms`,
            borderColor: row.you ? RED : "rgba(255,255,255,.09)",
            background: row.you ? "rgba(230,50,34,.1)" : "#141518",
          }}
        >
          <span className="label-cap w-4 text-[9px] text-grit-dim">{index + 1}</span>
          <span className="display text-xs font-extrabold text-grit">{row.name}</span>
          <span className="display ml-auto text-xs font-extrabold tabular-nums text-grit-dim">
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Exercise cards arriving, each with its own worked muscles. */
function LibraryDemo() {
  const lifts = [
    { name: "Bench Press", muscles: ["chest"] },
    { name: "Barbell Row", muscles: ["lats"] },
    { name: "Back Squat", muscles: ["quads"] },
  ];
  return (
    <div className="flex gap-2">
      {lifts.map((lift, index) => (
        <div
          key={lift.name}
          className="tour-stagger flex-1 rounded-xl border border-white/10 bg-[#141518] p-2 text-center"
          style={{ animationDelay: `${index * 220}ms` }}
        >
          <MuscleDiagram view="front" primary={lift.muscles} size={64} />
          <p className="mt-1 text-[9px] font-bold leading-tight text-grit">{lift.name}</p>
        </div>
      ))}
    </div>
  );
}

/** What the membership actually turns on. */
function MembershipDemo() {
  const items = ["Full Strength Map", "Every lift graded", "Weekly review", "Unlimited programmes"];
  return (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div
          key={item}
          className="tour-stagger flex items-center gap-2"
          style={{ animationDelay: `${index * 160}ms` }}
        >
          <span
            className="tour-tick grid h-4 w-4 shrink-0 place-items-center rounded-full"
            style={{ background: RED, animationDelay: `${index * 160 + 120}ms` }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="#fff"
              strokeWidth={5}
            >
              <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs text-grit">{item}</span>
        </div>
      ))}
    </div>
  );
}
