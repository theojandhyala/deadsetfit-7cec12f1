import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, LogOut, Crown, UserPlus, Pencil } from "lucide-react";
import { useAppState } from "@/lib/storage";
import {
  calculateStreak, calculateGritScore, gritBadge, badgeColor,
  bestSetFor, maxRepsFor,
} from "@/lib/calc";
import { saveProfile } from "@/lib/profile.functions";
import { GritLogo } from "@/components/GritLogo";


export const Route = createFileRoute("/_tabs/profile")({
  head: () => ({ meta: [{ title: "DEADSET — Profile" }] }),
  component: ProfilePage,
});

const PR_LIFTS: Array<{ id: string; label: string; kind: "1RM" | "REPS" }> = [
  { id: "bench-press", label: "Bench Press", kind: "1RM" },
  { id: "squat", label: "Squat", kind: "1RM" },
  { id: "deadlift", label: "Deadlift", kind: "1RM" },
  { id: "ohp", label: "Overhead Press", kind: "1RM" },
  { id: "pull-ups", label: "Pull-Ups", kind: "REPS" },
];

function ProfilePage() {
  const [state, set] = useAppState();
  const navigate = useNavigate();
  const persist = useServerFn(saveProfile);
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState<string>(p?.goal || "BULK");
  const [exp, setExp] = useState<string>(p?.experience || "BEGINNER");
  const [w, setW] = useState(String(p?.weightKg ?? ""));
  const [h, setH] = useState(String(p?.heightCm ?? ""));
  const [username, setUsername] = useState(p?.username || "");
  const [savingProfile, setSavingProfile] = useState(false);


  if (!p) return null;
  const streak = calculateStreak(state.completedDates);
  const score = calculateGritScore(state);
  const badge = gritBadge(score.total);
  const badgeC = badgeColor(badge);

  const startW = p.startingWeightKg ?? p.weightKg;
  const delta = p.weightKg - startW;
  const bmi = (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1);

  function save() {
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    set((s) => s.profile ? ({ ...s, profile: {
      ...s.profile, goal: goal as typeof s.profile.goal, experience: exp as typeof s.profile.experience,
      weightKg: Number(w) || s.profile.weightKg, heightCm: Number(h) || s.profile.heightCm,
      username: clean || s.profile.username,
    }}) : s);
    setEditing(false);
  }

  function changePhoto(file: File) {
    const r = new FileReader();
    r.onload = () => set((s) => s.profile ? ({ ...s, profile: { ...s.profile, avatarDataUrl: String(r.result) } }) : s);
    r.readAsDataURL(file);
  }

  function reset() {
    if (!confirm("Reset all your DEADSET data?")) return;
    localStorage.removeItem("grit_app_state_v1");
    navigate({ to: "/onboarding", replace: true });
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <GritLogo className="text-2xl" />
        <button onClick={() => editing ? save() : setEditing(true)} className="label-cap text-accent-red">
          {editing ? "Save" : "Edit"}
        </button>
      </header>

      {/* === Athlete card header === */}
      <section className="px-5 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <button onClick={() => fileRef.current?.click()} className="relative shrink-0">
            <div className="w-20 h-20 rounded-full border-4 border-accent-red overflow-hidden bg-grit-card flex items-center justify-center">
              {p.avatarDataUrl
                ? <img src={p.avatarDataUrl} alt="" className="w-full h-full object-cover" />
                : <span className="display text-2xl font-extrabold text-grit-dim">{(p.username || "G").charAt(0).toUpperCase()}</span>}
            </div>
            <span className="absolute -bottom-1 -right-1 bg-accent-red rounded-full p-1.5"><Pencil size={10} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])} />
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1 mb-1 border-b border-grit">
                <span className="text-grit-dim">@</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)}
                  className="bg-transparent outline-none display text-xl font-extrabold text-grit flex-1" />
              </div>
            ) : (
              <p className="display text-xl font-extrabold uppercase text-grit truncate">
                @{p.username || "athlete"}
              </p>
            )}
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1" style={{ background: badgeC + "22", border: `1px solid ${badgeC}` }}>
              {badge === "DEADSET GOD" && <Crown size={11} style={{ color: badgeC }} />}
              <span className="label-cap text-[10px]" style={{ color: badgeC }}>{badge}</span>
            </div>
          </div>
        </div>

        {/* DEADSET Score — huge */}
        <div className="bg-grit-card border border-grit p-5 mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="label-cap">DEADSET Score · LIVE</p>
            <button className="flex items-center gap-1 text-[10px] label-cap text-accent-red"><UserPlus size={11}/> FOLLOW</button>
          </div>
          <p className="display font-extrabold leading-none text-accent-red" style={{ fontSize: "5rem" }}>
            {score.total}
          </p>
          <div className="mt-3 h-1.5 bg-[#1a1a1a] overflow-hidden">
            <div className="h-full bg-accent-red transition-all" style={{ width: `${(score.total / 1000) * 100}%` }} />
          </div>
          {/* Live breakdown — every row links to its source tab */}
          <div className="mt-4 divide-y divide-[#262626] border-t border-[#262626]">
            <ScoreRow label="Workout Streak" detail={`${score.streak} days × 15`} pts={score.streak * 15} />
            <ScoreRow label="PRs This Week" detail={`${score.prs} × 25`} pts={score.prs * 25} />
            <ScoreRow label="Calorie Target Hits" detail={`${score.caloriesHit} days × 10`} pts={score.caloriesHit * 10} />
            <ScoreRow label="Protein Target Hits" detail={`${score.proteinHit} days × 10`} pts={score.proteinHit * 10} />
            <ScoreRow label="Photo Check-Ins" detail={`${score.checkIns} × 50`} pts={score.checkIns * 50} />
            <ScoreRow label="Measurements Logged" detail={`${score.measurements} × 20`} pts={score.measurements * 20} />
            {score.decay > 0 && <ScoreRow label="48h Inactivity Decay" detail="No activity recently" pts={-score.decay} />}
          </div>
        </div>


        {/* Streak */}
        <div className="bg-grit-card border border-grit p-4 flex items-center gap-4">
          <Flame size={28} className="text-accent-red" />
          <div>
            <p className="label-cap">Current Streak</p>
            <p className="display text-2xl font-extrabold text-grit leading-none">
              {streak}<span className="text-sm ml-2 text-grit-dim">days</span>
            </p>
          </div>
        </div>
      </section>

      {/* === Personal Records === */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Personal Records</p>
        <div className="grid grid-cols-2 gap-2">
          {PR_LIFTS.map((lift) => {
            if (lift.kind === "REPS") {
              const reps = maxRepsFor(state.logs, lift.id);
              return (
                <div key={lift.id} className="bg-grit-card border border-grit p-3">
                  <p className="label-cap text-[9px] truncate">{lift.label}</p>
                  <p className="display text-2xl font-extrabold text-grit leading-none mt-1">
                    {reps || "—"}<span className="text-xs ml-1 text-grit-dim">reps</span>
                  </p>
                </div>
              );
            }
            const best = bestSetFor(state.logs, lift.id);
            return (
              <div key={lift.id} className="bg-grit-card border border-grit p-3">
                <p className="label-cap text-[9px] truncate">{lift.label}</p>
                <p className="display text-2xl font-extrabold text-grit leading-none mt-1">
                  {best?.oneRm || "—"}<span className="text-xs ml-1 text-grit-dim">kg</span>
                </p>
                {best && <p className="text-[9px] text-grit-dim mt-1">{best.weight}×{best.reps} · 1RM est.</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* === Athlete Stats === */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Athlete Stats</p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {editing ? (
            <>
              <Field label="Goal"><Select value={goal} onChange={setGoal} opts={["BULK","CUT","MAINTAIN","ATHLETIC"]} /></Field>
              <Field label="Experience"><Select value={exp} onChange={setExp} opts={["BEGINNER","INTERMEDIATE","ADVANCED"]} /></Field>
              <Field label="Weight"><input value={w} onChange={(e) => setW(e.target.value)} className="input-grit text-right" /></Field>
              <Field label="Height"><input value={h} onChange={(e) => setH(e.target.value)} className="input-grit text-right" /></Field>
              <div className="p-3"><button onClick={save} className="btn-grit w-full">Save Changes</button></div>
            </>
          ) : (
            <>
              <Stat label="Goal" v={p.goal} />
              <Stat label="Experience" v={p.experience} />
              <Stat label="Days / Week" v={String(p.daysPerWeek)} />
              <Stat label="Current Weight" v={`${p.weightKg} kg`} />
              <div className="flex justify-between items-center px-4 py-3">
                <span className="label-cap">Start → Now</span>
                <span className="text-sm font-bold uppercase text-grit">
                  {startW} → {p.weightKg} kg{" "}
                  <span style={{ color: delta === 0 ? "#8a8a8a" : "#e63222" }}>
                    ({delta > 0 ? "+" : ""}{delta.toFixed(1)})
                  </span>
                </span>
              </div>
              <Stat label="Height" v={`${p.heightCm} cm`} />
              <Stat label="Age" v={`${p.age} yrs`} />
              <Stat label="BMI" v={bmi} />
              <Stat label="Gender" v={p.gender} />
              <Stat label="Equipment" v={p.equipment.replace("_"," ")} />
              {p.weakness && <Stat label="Focus Area" v={p.weakness} />}
              {p.injuries && <Stat label="Injuries" v={p.injuries} />}
            </>
          )}
        </div>
      </section>

      {/* Split overview */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Training Split</p>
        <div className="bg-grit-card border border-grit">
          {state.schedule && (["MON","TUE","WED","THU","FRI","SAT","SUN"] as const).map((d) => (
            <div key={d} className="px-4 py-3 border-b border-grit last:border-b-0 flex justify-between gap-3">
              <span className="label-cap">{d}</span>
              <span className="text-xs font-bold uppercase text-grit text-right">{state.schedule![d].label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DEADSET Pro */}
      <section className="px-5 mb-6">
        <div className="border border-accent-red p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2a0d0a 100%)" }}>
          <Crown size={20} className="text-accent-red mb-2" />
          <p className="display text-2xl font-extrabold uppercase text-grit">DEADSET Pro</p>
          <p className="text-xs text-[#8a8a8a] mt-1 mb-4">AI coach, advanced analytics, custom splits, video form review.</p>
          <button className="btn-grit w-full">Upgrade — $9.99 / mo</button>
        </div>
      </section>

      <section className="px-5 mb-10">
        <button onClick={reset} className="btn-ghost w-full"><LogOut size={14} className="mr-2" /> Reset All Data</button>
      </section>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="label-cap">{label}</span>
      <span className="text-sm font-bold uppercase text-grit">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 grid grid-cols-[100px_1fr] items-center gap-3">
      <span className="label-cap">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-grit">
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ScoreRow({ label, detail, pts }: { label: string; detail: string; pts: number }) {
  const neg = pts < 0;
  return (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-grit truncate">{label}</p>
        <p className="text-[10px] text-grit-dim">{detail}</p>
      </div>
      <span className="display text-base font-extrabold tabular-nums" style={{ color: neg ? "#e63222" : pts > 0 ? "#22c55e" : "#8a8a8a" }}>
        {neg ? "" : "+"}{pts}
      </span>
    </div>
  );
}
