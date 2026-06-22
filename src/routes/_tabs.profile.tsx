import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { useAppState, flushRemoteState } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { calculateStreak, calculateGritScore, gritBadge, badgeColor } from "@/lib/calc";
import { saveProfile } from "@/lib/profile.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { FifaCard } from "@/components/FifaCard";
import { QuickLogFAB } from "@/components/QuickLogFAB";
import { StatsGrid } from "@/components/StatsGrid";
import { LiftLevels } from "@/components/LiftLevels";
import { TrophyCase } from "@/components/TrophyCase";
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
  const persist = useServerFn(saveProfile);
  const deleteAcct = useServerFn(deleteMyAccount);
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState<string>(p?.goal || "BULK");
  const [exp, setExp] = useState<string>(p?.experience || "BEGINNER");
  const [w, setW] = useState(String(p?.weightKg ?? ""));
  const [h, setH] = useState(String(p?.heightCm ?? ""));
  const [username, setUsername] = useState(p?.username || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [session, setSession] = useState<{ userId: string } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // _tabs already validates the session before mounting. Read it without
    // a long-running getSession() call so the profile page renders instantly.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session ? { userId: data.session.user.id } : null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setSessionChecked(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (cancelled) return;
      setSession(s ? { userId: s.user.id } : null);
      setSessionChecked(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-push public_stats whenever logs / manualPRs / sessions change.
  useEffect(() => {
    if (!p) return;
    const stats = buildPublicStats(state);
    persist({ data: { public_stats: stats } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.manualPRs && JSON.stringify(state.manualPRs),
    state.logs?.length ?? 0,
    state.sessions?.length ?? 0,
    p?.weightKg,
    p?.heightCm,
    p?.goal,
    p?.experience,
  ]);



  if (!sessionChecked && !p) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="w-6 h-6 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!p || !session) {
    return (
      <div className="px-5 pt-8 animate-fade-in">
        <h1 className="display text-4xl font-extrabold text-white leading-none mb-2">
          YOUR<br /><span style={{ color: "#E10600" }}>PROFILE</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8A8A8A" }}>
          Sign in to track your progress, compete, and build your legacy.
        </p>
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="btn-grit w-full mb-4"
        >
          Sign In / Create Account
        </button>
        <button
          onClick={() => navigate({ to: "/friends" })}
          className="w-full flex items-center gap-3 p-4 press"
          style={{
            background: "rgba(225,6,0,0.08)",
            border: "1.5px solid rgba(225,6,0,0.3)",
            borderRadius: 14,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 40, height: 40, background: "#E10600" }}
          >
            <Sparkles size={18} color="#fff" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white">Find Your Crew</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A8A8A" }}>Add mates, climb leagues, share PRs.</p>
          </div>
          <span className="text-lg" style={{ color: "#E10600" }}>›</span>
        </button>
      </div>
    );
  }

  const streak = calculateStreak(state.completedDates);
  const score = calculateGritScore(state);
  const badge = gritBadge(score.total);
  const badgeC = badgeColor(badge);
  let fifa: ReturnType<typeof computeFifaStats>;
  try {
    fifa = computeFifaStats(state);
  } catch {
    fifa = computeFifaStats({ ...state, logs: [], sessions: [], manualPRs: {} });
  }
  const startW = p.startingWeightKg ?? p.weightKg;
  const delta = p.weightKg - startW;
  const heightM = (p.heightCm ?? 170) / 100;
  const bmi = heightM > 0 ? (p.weightKg / Math.pow(heightM, 2)).toFixed(1) : "—";

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
    toast.success("PR saved");
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
      await deleteAcct({});
      try {
        localStorage.removeItem("grit_app_state_v1");
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut();
      toast.success("Account deleted");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete account");
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Strava-style profile hero */}
      <div
        className="relative mb-0"
        style={{
          background: "linear-gradient(180deg, #141414 0%, #0A0A0A 100%)",
          borderBottom: "1px solid #262626",
        }}
      >
        {/* Cover area */}
        <div
          className="w-full"
          style={{
            height: 80,
            background: `linear-gradient(135deg, rgba(225,6,0,0.2) 0%, rgba(225,6,0,0.05) 100%)`,
          }}
        />

        {/* Avatar + edit */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="relative">
              <button onClick={() => fileRef.current?.click()} className="relative press">
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#141414",
                    border: `3px solid #0A0A0A`,
                    boxShadow: `0 0 0 2px ${badgeC}`,
                  }}
                >
                  {p.avatarDataUrl ? (
                    <img src={p.avatarDataUrl} alt={p.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="display font-extrabold text-white text-3xl">
                      {(p.username || "A").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div
                  className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
                  style={{ width: 24, height: 24, background: "#E10600" }}
                >
                  <Pencil size={11} color="#fff" />
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])}
              />
            </div>
            <button
              onClick={() => (editing ? save() : setEditing(true))}
              disabled={savingProfile}
              className="press"
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                background: editing ? "#E10600" : "transparent",
                border: `1.5px solid ${editing ? "#E10600" : "#262626"}`,
                color: editing ? "#fff" : "#ffffff",
                fontSize: "0.82rem",
                fontWeight: 700,
                opacity: savingProfile ? 0.6 : 1,
              }}
            >
              {editing ? (savingProfile ? "Saving…" : "Save") : "Edit Profile"}
            </button>
          </div>

          {/* Name + badge */}
          <h1 className="display text-2xl font-extrabold text-white leading-tight">
            {p.username || "Athlete"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: `${badgeC}20`, color: badgeC, border: `1px solid ${badgeC}50` }}
            >
              {badge}
            </span>
            <span className="text-[11px]" style={{ color: "#8A8A8A" }}>
              {p.goal?.replace("_", " ")} · {p.experience}
            </span>
          </div>

          {/* Stats row — Strava style */}
          <div
            className="flex mt-4 rounded-xl overflow-hidden"
            style={{ border: "1.5px solid #262626" }}
          >
            {[
              { label: "Streak", value: `${streak}`, unit: "days" },
              { label: "Score", value: `${score.total}`, unit: "pts" },
              { label: "Sessions", value: `${(state.sessions ?? []).length}`, unit: "total" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex-1 py-3 flex flex-col items-center"
                style={{
                  background: "#141414",
                  borderRight: i < 2 ? "1px solid #262626" : "none",
                }}
              >
                <div className="flex items-baseline gap-1">
                  <span className="display text-xl font-extrabold text-white">{s.value}</span>
                  <span className="text-[10px] font-semibold" style={{ color: "#8A8A8A" }}>{s.unit}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#8A8A8A" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === FIFA card === */}
      <section className="px-4 mb-4 mt-4 animate-scale-in delay-100">
        <FifaCard
          name={p.username || "Athlete"}
          username={p.username}
          avatarUrl={p.avatarDataUrl}
          badge={badge}
          badgeColor={badgeC}
          overall={fifa.overall}
          prs={buildHeadlinePRs(state)}
          weightKg={p.weightKg}
          heightCm={p.heightCm}
          goal={p.goal}
          experience={p.experience}
        />
      </section>

      {/* Share Profile */}
      {p.username && <ShareProfileCard username={p.username} />}

      <StatsGrid state={state} />
      <LiftLevels state={state} />
      <TrophyCase state={state} />

      {/* === Personal Records === */}
      <section className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Trophy size={14} style={{ color: "#FAFAFA" }} /> Personal Records
          </p>
          <span className="text-[10px] font-semibold" style={{ color: "#8A8A8A" }}>Tap to update</span>
        </div>
        <div
          className="overflow-hidden"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
        >
          {PR_CATALOG.map((def, i) => {
            const pr = state.manualPRs?.[def.id];
            return (
              <div key={def.id} style={{ borderTop: i > 0 ? "1px solid #262626" : "none" }}>
                <PRRow def={def} pr={pr} onSave={(v, r) => savePR(def, v, r)} />
              </div>
            );
          })}
        </div>
      </section>

      {/* === Athlete Stats === */}
      <section className="px-4 mb-5">
        <p className="text-sm font-bold text-white mb-3">Athlete Stats</p>
        <div
          className="overflow-hidden"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
        >
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
              {delta !== 0 && (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Weight Journey</span>
                  <span className="text-sm font-semibold text-white">
                    {startW} → {p.weightKg} kg{" "}
                    <span style={{ color: delta > 0 ? "#FAFAFA" : "#E10600" }}>
                      ({delta > 0 ? "+" : ""}{delta.toFixed(1)})
                    </span>
                  </span>
                </div>
              )}
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
      <section className="px-4 mb-5">
        <div
          className="p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(225,6,0,0.15) 0%, rgba(225,6,0,0.05) 100%)",
            border: "1.5px solid rgba(225,6,0,0.4)",
            borderRadius: 14,
          }}
        >
          <Crown size={20} style={{ color: "#E10600", marginBottom: 8 }} />
          <p className="display text-xl font-extrabold uppercase text-white">DEADSET Pro</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "#8A8A8A" }}>
            AI coach · Advanced analytics · Custom splits · Weekly leagues
          </p>
          <Link to="/upgrade" className="btn-grit w-full block text-center" style={{ borderRadius: 10 }}>
            Unlock Pro
          </Link>
        </div>
      </section>

      {/* Action buttons */}
      <section className="px-4 mb-5 flex flex-col gap-2.5">
        <Link
          to="/coach"
          className="flex items-center gap-3 p-4 press"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, background: "rgba(225,6,0,0.12)" }}
          >
            <Sparkles size={16} style={{ color: "#E10600" }} />
          </div>
          <span className="font-semibold text-white text-sm">Ask DEADSET Coach</span>
          <span className="ml-auto text-lg" style={{ color: "#8A8A8A" }}>›</span>
        </Link>
        <Link
          to="/recovery"
          className="flex items-center gap-3 p-4 press"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, background: "rgba(225,6,0,0.12)" }}
          >
            <Heart size={16} style={{ color: "#E10600" }} />
          </div>
          <span className="font-semibold text-white text-sm">Recovery & Mobility</span>
          <span className="ml-auto text-lg" style={{ color: "#8A8A8A" }}>›</span>
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 p-4 press"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, background: "#141414" }}
          >
            <Settings size={16} style={{ color: "#8A8A8A" }} />
          </div>
          <span className="font-semibold text-white text-sm">Settings</span>
          <span className="ml-auto text-lg" style={{ color: "#8A8A8A" }}>›</span>
        </Link>

        <button
          onClick={logout}
          className="flex items-center gap-3 p-4 w-full text-left press"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, background: "#141414" }}
          >
            <LogOut size={16} style={{ color: "#8A8A8A" }} />
          </div>
          <span className="font-semibold text-white text-sm">Sign Out</span>
        </button>

        <button
          onClick={reset}
          className="py-3 text-sm font-semibold press"
          style={{ color: "#8A8A8A", background: "#141414", border: "1.5px solid #262626", borderRadius: 12, width: "100%" }}
        >
          Reset This Device
        </button>

        <button
          onClick={deleteAccount}
          className="py-3 text-sm font-semibold flex items-center justify-center gap-2 press"
          style={{
            color: "#ff4444",
            background: "rgba(255,68,68,0.05)",
            border: "1.5px solid rgba(255,68,68,0.3)",
            borderRadius: 12,
            width: "100%",
          }}
        >
          <Trash2 size={14} /> Delete Account
        </button>
      </section>

      <section className="px-4 pb-10 flex justify-center gap-4 text-[10px] font-semibold" style={{ color: "#6B7280" }}>
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
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{def.label}</p>
        {pr && (
          <p className="text-[10px] mt-0.5" style={{ color: "#8A8A8A" }}>
            Current: {pr.value} {unit}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          placeholder="—"
          className="input-grit w-20 text-right py-2"
          style={{ borderRadius: 8 }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-wider w-8"
          style={{ color: "#8A8A8A" }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>{label}</span>
      <span className="text-sm font-semibold text-white">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>{label}</span>
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

function ShareProfileCard({ username }: { username: string }) {
  const profileUrl = `https://deadsetfit.org/u/${username}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Profile link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "DEADSET — My Profile", url: profileUrl });
        return;
      } catch {
        /* user cancelled or not supported */
      }
    }
    copyLink();
  }

  return (
    <section className="px-4 mb-4">
      <div
        className="p-4"
        style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "#8A8A8A" }}>
          Share Profile
        </p>
        <button
          onClick={copyLink}
          className="w-full flex items-center justify-between px-3 py-2.5 mb-3 text-left press"
          style={{ background: "#141414", borderRadius: 10, border: "1px solid #262626" }}
        >
          <span className="text-xs truncate flex-1" style={{ color: "#8A8A8A" }}>{profileUrl}</span>
          {copied ? (
            <Check size={13} style={{ color: "#E10600", marginLeft: 8, flexShrink: 0 }} />
          ) : (
            <Copy size={13} style={{ color: "#6B7280", marginLeft: 8, flexShrink: 0 }} />
          )}
        </button>
        <button
          onClick={share}
          className="btn-grit w-full flex items-center justify-center gap-2 text-sm"
          style={{ borderRadius: 10 }}
        >
          <Share2 size={14} /> Share Profile
        </button>
      </div>
    </section>
  );
}
