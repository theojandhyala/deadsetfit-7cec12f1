import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { toast } from "sonner";
import {
  Flame,
  LogOut,
  Crown,
  Pencil,
  Trophy,
  Trash2,
  Settings,
  Sparkles,
  Heart,
} from "lucide-react";
import { useAppState, flushRemoteState } from "@/lib/storage";
import {
  clearSessionBackup,
  restoreSupabaseSession,
  supabase,
} from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/account-restore";
import { calculateStreak, calculateGritScore, gritBadge, badgeColor } from "@/lib/calc";
import { emitGritEarned } from "@/lib/grit-events";
import { saveProfile } from "@/lib/profile.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { usePro } from "@/hooks/usePro";
import { FifaCard } from "@/components/FifaCard";
import { QuickLogFAB } from "@/components/QuickLogFAB";
import { StatsGrid } from "@/components/StatsGrid";
import { LiftLevels } from "@/components/LiftLevels";
import { TrophyCase } from "@/components/TrophyCase";
import { RankedArena } from "@/components/RankedArena";
import {
  PR_CATALOG,
  computeFifaStats,
  buildPublicStats,
  buildHeadlinePRs,
  type PRDef,
} from "@/lib/fifa-stats";

export const Route = createFileRoute("/_tabs/profile")({
  head: () => ({ meta: [{ title: "DEADSET — Profile" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [state, set] = useAppState();
  const navigate = useNavigate();
  const persist = saveProfile;
  const deleteAcct = deleteMyAccount;
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState<string>(p?.goal || "BULK");
  const [exp, setExp] = useState<string>(p?.experience || "BEGINNER");
  const [w, setW] = useState(String(p?.weightKg ?? ""));
  const [h, setH] = useState(String(p?.heightCm ?? ""));
  const [username, setUsername] = useState(p?.username || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const {
    isPro,
    status: proStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    refresh: refreshPro,
  } = usePro();
  const manualPRKey = state.manualPRs ? JSON.stringify(state.manualPRs) : "";

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setSession((s) => (s === "loading" ? null : s));
    }, 8000);
    (async () => {
      await withTimeout(restoreSupabaseSession(), undefined, 2500);
      return withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        4500,
      );
    })()
      .then(({ data }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setSession(data.session ? { userId: data.session.user.id } : null);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeout);
        setSession(null);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (cancelled) return;
      clearTimeout(timeout);
      setSession(s ? { userId: s.user.id } : null);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-push public_stats + grit whenever logs / manualPRs / sessions change.
  // grit_points powers the RANK leaderboard and league placement server-side.
  const gritTotal = calculateGritScore(state).total;
  useEffect(() => {
    if (!p) return;
    const stats = buildPublicStats(state);
    persist({ data: { public_stats: stats, grit_points: gritTotal } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manualPRKey,
    state.logs.length,
    state.sessions.length,
    gritTotal,
    p?.weightKg,
    p?.heightCm,
    p?.goal,
    p?.experience,
  ]);

  if (session === "loading" && !p) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="text-grit-dim text-xs label-cap">Loading…</div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="px-6 pt-4">
        <header className="mb-8">
          <p className="label-cap">PROFILE</p>
          <h1 className="display text-5xl font-extrabold text-grit leading-none mt-1">
            YOUR
            <br />
            STATS.
          </h1>
        </header>
        <div className="bg-grit-card border border-grit p-6 mb-4">
          <p className="text-sm text-[#8a8a8a] mb-4">
            Sign in to save your profile, sync across devices, and compete on the leaderboard.
          </p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="btn-grit w-full py-3 label-cap"
          >
            Sign in / Create account
          </button>
        </div>
        <button
          onClick={() => navigate({ to: "/friends" })}
          className="w-full bg-grit-card border border-accent-red p-4 flex items-center gap-3 text-left hover:bg-[#1a1a1a]"
        >
          <div className="w-10 h-10 bg-accent-red flex items-center justify-center">
            <Sparkles size={18} className="text-grit-bg" />
          </div>
          <div className="flex-1">
            <p className="label-cap text-accent-red">FIND YOUR CREW</p>
            <p className="text-xs text-[#8a8a8a] mt-0.5">Add mates, climb leagues, share PRs.</p>
          </div>
        </button>
      </div>
    );
  }

  const streak = calculateStreak(state.completedDates);
  const score = calculateGritScore(state);
  const badge = gritBadge(score.total);
  const badgeC = badgeColor(badge);
  const fifa = computeFifaStats(state);
  const startW = p.startingWeightKg ?? p.weightKg;
  const delta = p.weightKg - startW;
  const bmi = (p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1);

  async function save() {
    if (!p) return;
    const clean = username
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);
    const newWeight = Number(w) || p.weightKg;
    const newHeight = Number(h) || p.heightCm;
    const newUsername = clean || p.username;
    setSavingProfile(true);
    try {
      await persist({
        data: {
          username: newUsername,
          display_name: newUsername,
          goal: goal as "BULK" | "CUT" | "MAINTAIN" | "ATHLETIC",
          experience: exp as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
          weight_kg: newWeight,
          height_cm: newHeight,
        },
      });
      set((s) =>
        s.profile
          ? {
              ...s,
              profile: {
                ...s.profile,
                goal: goal as typeof s.profile.goal,
                experience: exp as typeof s.profile.experience,
                weightKg: newWeight,
                heightCm: newHeight,
                username: newUsername,
              },
            }
          : s,
      );
      await flushRemoteState();
      setEditing(false);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  function changePhoto(file: File) {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      set((s) => (s.profile ? { ...s, profile: { ...s.profile, avatarDataUrl: url } } : s));
      persist({ data: { avatar_url: url } }).catch(() => {});
      void flushRemoteState();
    };
    r.readAsDataURL(file);
  }

  function savePR(def: PRDef, value: number, reps?: number) {
    if (!value || value <= 0) {
      // delete
      set((s) => {
        const copy = { ...(s.manualPRs ?? {}) };
        delete copy[def.id];
        return { ...s, manualPRs: copy };
      });
    } else {
      set((s) => ({
        ...s,
        manualPRs: {
          ...(s.manualPRs ?? {}),
          [def.id]: {
            value,
            reps: def.kind === "1RM" ? reps || 1 : undefined,
            date: new Date().toISOString().slice(0, 10),
          },
        },
      }));
    }
    void flushRemoteState();
    toast.success("PR saved");
    if (value > 0) emitGritEarned(25, "PR SAVED", "pr");
  }

  async function logout() {
    toast.loading("Saving your data…", { id: "logout" });
    try {
      // Push any unsaved local state to the server BEFORE auth is dropped.
      if (p) {
        await persist({ data: { public_stats: buildPublicStats(state) } }).catch(() => {});
      }
      await flushRemoteState();
    } finally {
      toast.dismiss("logout");
    }
    window.dispatchEvent(new CustomEvent("deadset:explicit-logout"));
    clearSessionBackup();
    await supabase.auth.signOut();
    toast.success("Signed out — your data is saved");
    navigate({ to: "/auth", replace: true });
  }

  function reset() {
    if (!confirm("Reset all your DEADSET data on this device? Your account stays signed in."))
      return;
    localStorage.removeItem("grit_app_state_v1");
    navigate({ to: "/onboarding", replace: true });
  }

  async function deleteAccount() {
    const ok = confirm(
      "PERMANENTLY DELETE your DEADSET account?\n\n" +
        "This erases your profile, posts, comments, follows, PRs and training history. " +
        "It cannot be undone.",
    );
    if (!ok) return;
    const confirm2 = prompt('Type "DELETE" to confirm:');
    if (confirm2 !== "DELETE") {
      toast.error("Cancelled — confirmation did not match");
      return;
    }
    try {
      await deleteAcct();
      try {
        localStorage.removeItem("grit_app_state_v1");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("deadset:explicit-logout"));
      clearSessionBackup();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete account");
    }
  }

  return (
    <div className="deadset-page">
      <header className="px-5 pt-4 pb-3 flex items-start justify-between">
        <p className="label-cap">YOUR CARD</p>
        <button
          onClick={() => (editing ? save() : setEditing(true))}
          disabled={savingProfile}
          className="label-cap text-accent-red disabled:opacity-50 mt-1"
        >
          {editing ? (savingProfile ? "..." : "Save") : "Edit"}
        </button>
      </header>

      {/* === FIFA card === */}
      <section className="px-5 mb-5 relative">
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute top-1 right-7 z-10 bg-accent-red rounded-full p-1.5 shadow"
          aria-label="Change photo"
        >
          <Pencil size={10} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])}
        />
        <FifaCard
          name={p.username || "Athlete"}
          username={p.username}
          avatarUrl={p.avatarDataUrl}
          badge={badge}
          badgeColor={badgeC}
          overall={fifa.overall}
          gritPoints={score.total}
          prs={buildHeadlinePRs(state)}
          weightKg={p.weightKg}
          heightCm={p.heightCm}
          goal={p.goal}
          experience={p.experience}
        />
      </section>

      <section className="px-5 mb-4">
        <RankedArena state={state} compact />
      </section>

      {/* Streak */}
      <section className="px-5 mb-5">
        <div className="bg-grit-card border border-grit rounded-2xl p-4 flex items-center gap-4">
          <Flame size={28} className="text-accent-red" />
          <div>
            <p className="label-cap">Current Streak</p>
            <p className="display text-2xl font-extrabold text-grit leading-none">
              {streak}
              <span className="text-sm ml-2 text-grit-dim">days</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="label-cap">DEADSET Score</p>
            <p className="display text-2xl font-extrabold leading-none" style={{ color: badgeC }}>
              {score.total}
            </p>
          </div>
        </div>
      </section>

      <StatsGrid state={state} />
      <LiftLevels state={state} />
      <TrophyCase state={state} />

      {/* === Personal Records — flat list === */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap flex items-center gap-1.5">
            <Trophy size={12} className="text-accent-red" /> Personal Records
          </p>
          <span className="text-[10px] text-grit-dim">Type your best</span>
        </div>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {PR_CATALOG.map((def) => {
            const pr = state.manualPRs?.[def.id];
            return <PRRow key={def.id} def={def} pr={pr} onSave={(v, r) => savePR(def, v, r)} />;
          })}
        </div>
      </section>

      {/* === Athlete Stats === */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Athlete Stats</p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {editing ? (
            <>
              <Field label="Username">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-grit w-full"
                  maxLength={20}
                />
              </Field>
              <Field label="Goal">
                <Select
                  value={goal}
                  onChange={setGoal}
                  opts={["BULK", "CUT", "MAINTAIN", "ATHLETIC"]}
                />
              </Field>
              <Field label="Experience">
                <Select
                  value={exp}
                  onChange={setExp}
                  opts={["BEGINNER", "INTERMEDIATE", "ADVANCED"]}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  value={w}
                  onChange={(e) => setW(e.target.value)}
                  inputMode="decimal"
                  className="input-grit text-right w-full"
                />
              </Field>
              <Field label="Height (cm)">
                <input
                  value={h}
                  onChange={(e) => setH(e.target.value)}
                  inputMode="decimal"
                  className="input-grit text-right w-full"
                />
              </Field>
              <div className="p-3">
                <button onClick={save} disabled={savingProfile} className="btn-grit w-full">
                  {savingProfile ? "Saving…" : "Save Changes"}
                </button>
              </div>
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
                    ({delta > 0 ? "+" : ""}
                    {delta.toFixed(1)})
                  </span>
                </span>
              </div>
              <Stat label="Height" v={`${p.heightCm} cm`} />
              <Stat label="Age" v={`${p.age} yrs`} />
              <Stat label="BMI" v={bmi} />
              <Stat label="Gender" v={p.gender} />
              <Stat label="Equipment" v={p.equipment.replace("_", " ")} />
              {p.weakness && <Stat label="Focus Area" v={p.weakness} />}
              {p.injuries && <Stat label="Injuries" v={p.injuries} />}
            </>
          )}
        </div>
      </section>

      {/* DEADSET Pro */}
      <section className="px-5 mb-6">
        <div
          className={`border p-5 relative overflow-hidden ${isPro ? "border-yellow-500/70" : "border-accent-red"}`}
          style={{
            background: isPro
              ? "linear-gradient(135deg, #1a1a1a 0%, #2b2108 55%, #100804 100%)"
              : "linear-gradient(135deg, #1a1a1a 0%, #2a0d0a 100%)",
          }}
        >
          <Crown size={20} className={isPro ? "text-yellow-400 mb-2" : "text-accent-red mb-2"} />
          <p className="display text-2xl font-extrabold uppercase text-grit">
            {isPro ? "DEADSET Pro Active" : "DEADSET Pro"}
          </p>
          <p className="text-xs text-[#8a8a8a] mt-1 mb-4">
            {isPro
              ? `Unlocked: Streak Armor, H2H challenges, full weekly leagues, advanced analytics and featured programs.${currentPeriodEnd ? ` Renews ${new Date(currentPeriodEnd).toLocaleDateString()}.` : ""}${cancelAtPeriodEnd ? " Cancels at period end." : ""}`
              : "Streak Armor, H2H challenges, full leagues, advanced analytics, featured programs."}
          </p>
          {isPro ? (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/upgrade" className="btn-ghost w-full inline-flex justify-center">
                Manage Pro
              </Link>
              <button onClick={() => void refreshPro()} className="btn-grit w-full">
                Refresh
              </button>
            </div>
          ) : (
            <Link to="/upgrade" className="btn-grit w-full inline-flex justify-center">
              Upgrade — Go Pro
            </Link>
          )}
          {isPro && proStatus && (
            <p className="mt-3 label-cap text-[10px] text-yellow-400/80">Status: {proStatus}</p>
          )}
        </div>
      </section>

      <section className="px-5 mb-6 flex flex-col gap-2">
        <Link to="/recovery" className="btn-ghost w-full inline-flex items-center justify-center">
          <Heart size={14} className="mr-2" /> Recovery & Mobility
        </Link>
        <Link to="/settings" className="btn-ghost w-full inline-flex items-center justify-center">
          <Settings size={14} className="mr-2" /> Settings
        </Link>

        <button
          onClick={logout}
          className="btn-grit w-full inline-flex items-center justify-center"
        >
          <LogOut size={14} className="mr-2" /> Log Out (saves your data)
        </button>
        <button onClick={reset} className="btn-ghost w-full">
          Reset This Device
        </button>

        <button
          onClick={deleteAccount}
          className="w-full mt-2 py-3 label-cap text-sm inline-flex items-center justify-center border border-accent-red text-accent-red hover:bg-accent-red/10 transition-colors"
        >
          <Trash2 size={14} className="mr-2" /> Delete My Account
        </button>
      </section>

      <section className="px-5 pb-10 flex justify-center gap-4 label-cap text-[10px] text-grit-dim">
        <Link to="/privacy">Privacy</Link>
        <span>·</span>
        <Link to="/terms">Terms</Link>
        <span>·</span>
        <Link to="/disclaimer">Disclaimer</Link>
      </section>

      <QuickLogFAB />
    </div>
  );
}

function PRRow({
  def,
  pr,
  onSave,
}: {
  def: PRDef;
  pr?: { value: number; reps?: number };
  onSave: (value: number, reps?: number) => void;
}) {
  const [val, setVal] = useState(String(pr?.value ?? ""));
  useEffect(() => {
    setVal(String(pr?.value ?? ""));
  }, [pr?.value]);

  const unit = def.kind === "1RM" ? "kg" : def.kind === "REPS" ? "reps" : "sec";

  function commit() {
    const n = Number(val);
    const current = pr?.value ?? 0;
    if (val.trim() === "" && pr) {
      onSave(0);
      return;
    }
    if (!Number.isFinite(n) || n === current) return;
    onSave(n, def.kind === "1RM" ? (pr?.reps ?? 1) : undefined);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <p className="text-sm font-bold text-grit truncate">{def.label}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          placeholder="—"
          className="input-grit w-20 text-right py-1.5"
        />
        <span className="label-cap text-[10px] text-grit-dim w-8">{unit}</span>
      </div>
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
    <div className="px-4 py-3 grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="label-cap">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  opts,
}: {
  value: string;
  onChange: (v: string) => void;
  opts: string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-grit w-full">
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
