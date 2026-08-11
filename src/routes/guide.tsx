import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Apple,
  BarChart3,
  Brain,
  Camera,
  ChevronLeft,
  Dumbbell,
  Flame,
  ScanFace,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/guide")({
  head: () => ({ meta: [{ title: "DEADSET — Guide" }] }),
  component: GuidePage,
});

function GuidePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-grit pb-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-5 pb-4 border-b border-grit flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/train" })}
          aria-label="Back to Train"
          className="icon-btn -ml-2 text-grit-dim"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="label-cap text-accent-red text-[10px]">START HERE</p>
          <h1 className="display text-3xl font-extrabold uppercase text-grit leading-none">
            How DEADSET Works
          </h1>
        </div>
      </header>

      <main className="px-5 pt-5 space-y-5">
        <section className="border border-accent-red bg-grit-card p-5 relative overflow-hidden rounded-xl">
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-red/20 blur-2xl" />
          <p className="label-cap text-accent-red text-[10px]">THE LOOP</p>
          <h2 className="display text-2xl font-extrabold uppercase text-grit mt-1">
            Train. Log. Rank up. Compete.
          </h2>
          <p className="text-sm text-grit-dim leading-relaxed mt-2">
            DEADSET turns your training into a ranked game. Build a schedule, complete workouts, hit
            PRs, track your body, earn grit, climb arenas, and challenge friends.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <QuickLink to="/train" icon={<Dumbbell size={14} />} label="Start training" />
            <QuickLink to="/friends" icon={<Users size={14} />} label="Find friends" />
            <QuickLink to="/leaderboard" icon={<Trophy size={14} />} label="Leaderboards" />
            <QuickLink to="/progress" icon={<ScanFace size={14} />} label="Track progress" />
          </div>
        </section>

        {/* The app invents a fair amount of vocabulary. Define it once, plainly,
            rather than expecting people to infer it from context. */}
        <section className="border border-grit bg-grit-card p-5">
          <p className="label-cap text-accent-red text-[10px]">THE WORDS WE USE</p>
          <h2 className="display text-2xl font-extrabold uppercase text-grit mt-1">
            In plain English
          </h2>
          <dl className="mt-3 space-y-3">
            {[
              ["Grit", "Points you earn for training. Finished workouts, streaks and personal bests all add grit."],
              ["Rank", "Your tier, based on total grit — Bronze up to DEADSET. It goes up as you train."],
              ["PR", "Personal record: the heaviest you've ever lifted on a given exercise."],
              ["Streak", "Days in a row you've trained. Miss a day and it resets."],
              ["Arena", "A league table you're placed in, so you're compared with people at your level."],
              ["Duel", "A head-to-head challenge against one friend, scored over a set period."],
              ["Schedule", "Your own training week — which days you train and what's on each day."],
              ["Program", "A ready-made week you can swap in instead of your own schedule."],
              ["Big 3", "Bench press, squat and deadlift — the three lifts used to gauge overall strength."],
              ["Adaptive TDEE", "Your real maintenance calories, measured from what you logged and how your weight actually moved — not a formula's guess."],
              ["Rep zones", "Where your sets land: 1–5 reps builds strength, 6–12 builds muscle, 13+ builds endurance. Progress shows your mix."],
            ].map(([term, meaning]) => (
              <div key={term}>
                <dt className="display text-sm font-extrabold uppercase text-grit">{term}</dt>
                <dd className="text-sm text-grit-dim leading-relaxed">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <GuideSection
          icon={<Dumbbell size={18} />}
          title="1. Build your training week"
          body="Open Plan to see the whole week at a glance. Choose a day to set its focus, then add exercises with the sets, reps, rest and order you want before training."
          bullets={[
            "Use Edit exercises on any day to change its full session.",
            "Choose Build My Split on Train if you want a fresh starting point.",
            "Finish workouts to keep your streak alive.",
          ]}
          to="/plan"
          cta="Open Plan"
        />

        <GuideSection
          icon={<Camera size={18} />}
          title="2. Track the body, not just the lifts"
          body="Go to Progress. Log bodyweight, measurements and a weekly check-in photo. Compare two photos side by side to see what actually changed."
          bullets={[
            "Use good lighting and a consistent pose.",
            "Log weight often — the trend tells the truth, not one reading.",
            "Strength curves and body-part volume show where the work is going.",
          ]}
          to="/progress"
          cta="Open Progress"
        />

        <GuideSection
          icon={<BarChart3 size={18} />}
          title="The intelligence stack"
          body="Everything you log feeds a set of engines that read your training back to you — no AI, just your own numbers. Each card appears only once there's enough data to be honest, so keep logging and they switch on one by one."
          bullets={[
            "Progress: session records, weekday rhythm, when you lift best, weekly grades, month rankings and your lifetime story.",
            "Diet insights: measured maintenance calories, training-day calorie cycling, protein spread and hydration.",
            "Train: week pace, streak record chase and superset time-savers on today's plan.",
          ]}
          to="/progress"
          cta="See your intelligence"
        />

        <GuideSection
          icon={<Flame size={18} />}
          title="3. Climb ranked arenas"
          body="Your grit score moves through Iron, Bronze, Silver, Gold, Platinum, Diamond, Elite, Master, Champion, Legend, Unreal and DEADSET."
          bullets={[
            "Complete workouts, streaks, PRs, diet hits and check-ins to gain grit.",
            "Ranked Arena cards show exactly what to do next.",
            "Share your rank card to TikTok, Stories or group chats.",
          ]}
          to="/profile"
          cta="View my rank"
        />

        <GuideSection
          icon={<Users size={18} />}
          title="4. Add friends and rivals"
          body="Open Friends to search usernames, follow nearby athletes, invite mates, and post lifts to your feed."
          bullets={[
            "Set your city to find local lifters without sharing exact location.",
            "Follow people to build your crew.",
            "Post PRs so friends can react, comment and chase your numbers.",
          ]}
          to="/friends"
          cta="Find friends"
        />

        <GuideSection
          icon={<Trophy size={18} />}
          title="5. Compete in arenas and PR boards"
          body="Arenas are your weekly competition layer. Challenge friends, beat daily challenges, climb the ranked board, and compare PRs."
          bullets={[
            "Challenge friends from the Challenges page.",
            "Leaderboards show Overall, Rank, Big 3, Bench, Squat and Deadlift.",
            "Athlete cards let you scout rivals before you chase them.",
          ]}
          to="/challenges"
          cta="Enter arenas"
        />

        <GuideSection
          icon={<Apple size={18} />}
          title="6. Diet and recovery keep the rank moving"
          body="Diet logs, water, protein and recovery all feed the system. The more complete your week is, the better your rank becomes."
          bullets={[
            "Use barcode lookup, presets or quick manual food logging.",
            "Hit protein and water quests for daily momentum.",
            "Use Recovery when sore instead of breaking the streak.",
          ]}
          to="/diet"
          cta="Open Diet"
        />

        <section className="bg-grit-card border border-grit p-5 rounded-xl">
          <p className="label-cap text-accent-red text-[10px] flex items-center gap-2">
            <Brain size={12} /> IF SOMETHING FEELS OFF
          </p>
          <p className="text-sm text-grit-dim leading-relaxed mt-2">
            Check Settings to confirm your account and sync status. Your workouts remain saved on
            this device if the connection drops and sync again when you are online.
          </p>
          <Link to="/auth" className="btn-ghost w-full mt-4 inline-flex justify-center">
            Sign in again
          </Link>
        </section>
      </main>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to as never}
      className="border border-grit bg-[#080808] px-3 py-2 flex items-center gap-2 rounded-lg"
    >
      <span className="text-accent-red">{icon}</span>
      <span className="label-cap text-[10px] text-grit">{label}</span>
    </Link>
  );
}

function GuideSection({
  icon,
  title,
  body,
  bullets,
  to,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  bullets: string[];
  to: string;
  cta: string;
}) {
  return (
    <section className="bg-grit-card border border-grit p-5 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-red/10 border border-accent-red flex items-center justify-center text-accent-red shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="display text-xl font-extrabold uppercase text-grit leading-tight">
            {title}
          </h2>
          <p className="text-sm text-grit-dim leading-relaxed mt-2">{body}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="text-xs text-grit leading-snug flex gap-2">
            <Sparkles size={12} className="text-accent-red shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        to={to as never}
        className="btn-grit w-full mt-4 inline-flex items-center justify-center gap-2"
      >
        <Share2 size={13} /> {cta}
      </Link>
    </section>
  );
}
