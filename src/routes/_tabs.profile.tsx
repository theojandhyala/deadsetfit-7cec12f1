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
  Check,
  Share2,
} from "lucide-react";
import { useAppState, flushRemoteState } from "@/lib/storage";
import { askConfirm, withDeadline } from "@/lib/confirm";
import {
  clearSessionBackup,
  restoreSupabaseSession,
  supabase,
} from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/account-restore";
import {
  calculateStreak,
  calculateGritScore,
  gritBadge,
  badgeColor,
  isoDay,
  defaultSchedule,
} from "@/lib/calc";

import { describeDays } from "@/lib/training-days";

const LABEL_EQUIPMENT: Record<string, string> = {
  FULL_GYM: "a full gym",
  HOME_GYM: "a home gym",
  BODYWEIGHT: "bodyweight only",
};

const SLEEP_LABEL: Record<string, string> = {
  LOW: "Under 6 hrs",
  OK: "6–7 hrs",
  GOOD: "7–8 hrs",
  GREAT: "8+ hrs",
};

const MOTIVATION_LABEL: Record<string, string> = {
  STRENGTH: "Get seriously strong",
  PHYSIQUE: "Build the physique",
  CONFIDENCE: "Feel confident again",
  DISCIPLINE: "Prove I can commit",
  COMPETE: "Compete and win",
};
import { currentMilestone, nextMilestone, milestoneProgress } from "@/lib/streak-milestones";
import { emitGritEarned } from "@/lib/grit-events";
import { saveProfile } from "@/lib/profile.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { usePro } from "@/hooks/usePro";
import { isNativeIos } from "@/lib/platform";
import { FifaCard } from "@/components/FifaCard";
import { ProBadge } from "@/components/ProBadge";
import { StreakShareCard } from "@/components/StreakShareCard";
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
  const [equip, setEquip] = useState<string>(p?.equipment || "FULL_GYM");
  // Edit-form inputs are DOM-owned (defaultValue + ref, read on save) — the
  // controlled value/onChange pattern freezes typing in the iOS WKWebView.
  const usernameRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const [editingPR, setEditingPR] = useState<PRDef | null>(null);
  const [showStreakShare, setShowStreakShare] = useState(false);
  const {
    // Identity/badging reflects a real paid subscription, not the blanket
    // iOS entitlement — a free iOS user shouldn't wear a PRO badge.
    isPaidPro: isPro,
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
    const clean = (usernameRef.current?.value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);
    const newWeight = Number(weightRef.current?.value) || p.weightKg;
    const newHeight = Number(heightRef.current?.value) || p.heightCm;
    const newUsername = clean || p.username;
    const newEquip = equip as typeof p.equipment;
    // Exercise choices are derived from equipment, so a change leaves the saved
    // week full of kit the lifter no longer has. Offer to rebuild rather than
    // silently rewriting days they may have hand-edited.
    let rebuildWeek = false;
    if (newEquip !== p.equipment) {
      rebuildWeek = await askConfirm({
        title: "Rebuild your week?",
        message: `Your plan was built for ${LABEL_EQUIPMENT[p.equipment] ?? p.equipment}. Rebuild it for ${LABEL_EQUIPMENT[newEquip] ?? newEquip}? This replaces the exercises on your training days.`,
        confirmLabel: "Rebuild",
        cancelLabel: "Keep my exercises",
      });
    }
    setSavingProfile(true);
    try {
      await persist({
        data: {
          username: newUsername,
          // Never clobber a distinct display name with the @handle.
          display_name: (p.displayName?.trim() || newUsername || "Athlete").slice(0, 60),
          goal: goal as "BULK" | "CUT" | "MAINTAIN" | "ATHLETIC",
          experience: exp as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
          equipment: newEquip,
          weight_kg: newWeight,
          height_cm: newHeight,
        },
      });
      set((s) => {
        if (!s.profile) return s;
        const profile = {
          ...s.profile,
          goal: goal as typeof s.profile.goal,
          experience: exp as typeof s.profile.experience,
          equipment: newEquip,
          weightKg: newWeight,
          heightCm: newHeight,
          username: newUsername,
        };
        return {
          ...s,
          profile,
          schedule: rebuildWeek ? defaultSchedule(profile) : s.schedule,
        };
      });
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
            date: isoDay(),
          },
        },
      }));
    }
    void flushRemoteState();
    toast.success(value > 0 ? "PR saved" : "PR removed");
    if (value > 0) emitGritEarned(25, "PR SAVED", "pr");
  }

  async function logout() {
    toast.loading("Saving your data…", { id: "logout" });
    try {
      // Push any unsaved local state to the server BEFORE auth is dropped —
      // but never let a slow network hold the sign-out hostage.
      await withDeadline(
        (async () => {
          if (p) {
            await persist({ data: { public_stats: buildPublicStats(state) } }).catch(() => {});
          }
          await flushRemoteState();
        })(),
        5000,
      );
    } finally {
      toast.dismiss("logout");
    }
    window.dispatchEvent(new CustomEvent("deadset:explicit-logout"));
    clearSessionBackup();
    try {
      await withDeadline(supabase.auth.signOut(), 4000);
    } catch {
      // Local session is already cleared by the explicit-logout event.
    }
    toast.success("Signed out — your data is saved");
    navigate({ to: "/auth", replace: true });
  }

  async function reset() {
    const ok = await askConfirm({
      title: "Reset this device?",
      message: "All DEADSET data on this device is wiped. Your account stays signed in.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (!ok) return;
    localStorage.removeItem("grit_app_state_v1");
    navigate({ to: "/onboarding", replace: true });
  }

  async function deleteAccount() {
    const ok = await askConfirm({
      title: "Delete your account?",
      message:
        "This erases your profile, posts, comments, follows, PRs and training history. It cannot be undone. Account deletion does not cancel an active App Store subscription; manage Pro first if you need to cancel billing.",
      confirmLabel: "Delete forever",
      danger: true,
      typedWord: "DELETE",
    });
    if (!ok) return;
    try {
      await deleteAcct();
      try {
        localStorage.removeItem("grit_app_state_v1");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("deadset:explicit-logout"));
      clearSessionBackup();
      try {
        await withDeadline(supabase.auth.signOut(), 4000);
      } catch {
        /* session already dropped */
      }
      toast.success("Account deleted");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete account");
    }
  }

  return (
    <div className="deadset-page">
      <header className="px-5 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <p className="label-cap">YOUR CARD</p>
          {isPro && <ProBadge size="sm" />}
        </div>
        <button
          onClick={() => (editing ? save() : setEditing(true))}
          disabled={savingProfile}
          className="label-cap tap-44 mt-1 text-accent-red disabled:opacity-50"
        >
          {editing ? (savingProfile ? "..." : "Save") : "Edit"}
        </button>
      </header>

      {/* === FIFA card === */}
      <section className="px-5 mb-5 relative">
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute top-1 right-7 z-10 bg-accent-red rounded-full p-1.5 shadow tap-44"
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
          name={p.displayName || p.username || "Athlete"}
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
          isPro={isPro}
        />
      </section>

      <section className="px-5 mb-4">
        <RankedArena state={state} compact />
      </section>

      {/* Streak */}
      <section className="px-5 mb-5">
        <div className="bg-grit-card border border-grit rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <Flame size={28} className="text-accent-red" />
            <div>
              <p className="label-cap flex items-center gap-2">
                Current Streak
                {streak >= 3 && (
                  <button
                    onClick={() => setShowStreakShare(true)}
                    aria-label="Share streak"
                    className="text-accent-red press tap-44"
                  >
                    <Share2 size={12} />
                  </button>
                )}
              </p>
              <p className="display text-2xl font-extrabold text-grit leading-none">
                {streak}
                <span className="text-sm ml-2 text-grit-dim">{streak === 1 ? "day" : "days"}</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="label-cap">DEADSET Score</p>
              <p className="display text-2xl font-extrabold leading-none" style={{ color: badgeC }}>
                {score.total}
              </p>
            </div>
          </div>
          {(() => {
            const cur = currentMilestone(streak);
            const next = nextMilestone(streak);
            return (
              <div className="mt-3 pt-3 border-t border-grit">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-grit">
                    {cur ? `${cur.emoji} ${cur.label}` : "🔥 First milestone: 3 days"}
                  </span>
                  {next && (
                    <span className="label-cap text-[10px] text-grit-dim">
                      {next.days - streak} to {next.label}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-[#0a0a0a] overflow-hidden">
                  <div
                    className="h-full bg-accent-red rounded-full"
                    style={{ width: `${Math.round(milestoneProgress(streak) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })()}
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
          <span className="text-[10px] text-grit-dim">Tap a lift to edit</span>
        </div>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {PR_CATALOG.map((def) => {
            const pr = state.manualPRs?.[def.id];
            return <PRRow key={def.id} def={def} pr={pr} onEdit={() => setEditingPR(def)} />;
          })}
        </div>
      </section>

      {editingPR && (
        <PREditSheet
          key={editingPR.id}
          def={editingPR}
          pr={state.manualPRs?.[editingPR.id]}
          onSave={(v, r) => savePR(editingPR, v, r)}
          onClose={() => setEditingPR(null)}
        />
      )}

      {/* === Athlete Stats === */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Athlete Stats</p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {editing ? (
            <>
              <Field label="Username">
                <input
                  ref={usernameRef}
                  defaultValue={p.username}
                  className="input-grit w-full"
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
              {/* Equipment decides which exercises your plan can use, so it has
                  to be changeable — moving gym, or losing access to one, used
                  to leave the plan permanently wrong. */}
              <Field label="Equipment">
                <Select
                  value={equip}
                  onChange={setEquip}
                  opts={["FULL_GYM", "HOME_GYM", "BODYWEIGHT"]}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  ref={weightRef}
                  defaultValue={String(p.weightKg ?? "")}
                  inputMode="decimal"
                  className="input-grit text-right w-full"
                />
              </Field>
              <Field label="Height (cm)">
                <input
                  ref={heightRef}
                  defaultValue={String(p.heightCm ?? "")}
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
              <Stat
                label="Training Days"
                v={
                  p.trainingDays?.length ? describeDays(p.trainingDays) : `${p.daysPerWeek} / week`
                }
              />
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
              {/* Onboarding asked for these and then showed them nowhere. If we
                  take the answer, it has to surface somewhere. */}
              {p.sessionMinutes && <Stat label="Session Length" v={`${p.sessionMinutes} min`} />}
              {p.focusMuscles?.length ? (
                <Stat label="Priority Muscles" v={p.focusMuscles.join(" · ")} />
              ) : null}
              {p.sleepQuality && <Stat label="Sleep" v={SLEEP_LABEL[p.sleepQuality]} />}
              {p.motivation && (
                <Stat label="Why You Train" v={MOTIVATION_LABEL[p.motivation] ?? p.motivation} />
              )}
              {p.targetWeightKg && <Stat label="Target Weight" v={`${p.targetWeightKg} kg`} />}
            </>
          )}
        </div>
      </section>

      {/* DEADSET Pro uses StoreKit on iPhone and Stripe on the website. */}
      <section className="px-5 mb-6">
        <div
          className={`border p-5 relative overflow-hidden ${isPro ? "border-pro pro-glow" : "border-accent-red"}`}
          style={{
            background: isPro
              ? "linear-gradient(135deg, #1c180c 0%, #2b2108 55%, #0d0a04 100%)"
              : "linear-gradient(135deg, #1a1a1a 0%, #2a0d0a 100%)",
          }}
        >
          {isPro && (
            <div className="absolute top-4 right-4">
              <ProBadge size="md" />
            </div>
          )}
          <Crown size={20} className={isPro ? "text-pro mb-2" : "text-accent-red mb-2"} />
          <p
            className={`display text-2xl font-extrabold uppercase ${isPro ? "text-pro-gradient" : "text-grit"}`}
          >
            DEADSET Pro
          </p>
          {isPro ? (
            <>
              <p className="label-cap text-[10px] text-pro/90 mt-0.5">Membership active</p>
              <div className="grid grid-cols-1 gap-1.5 mt-3 mb-4">
                {[
                  "Weekly Review + PR Roadmap",
                  "Streak Armor — never lose your streak",
                  "Progression intelligence + Ghost Mode",
                  "Full Weekly Leagues + H2H challenges",
                  "Advanced analytics & strength standards",
                  "Unlimited custom programs + featured plans",
                ].map((perk) => (
                  <div key={perk} className="flex items-center gap-2 text-xs text-grit">
                    <Check size={13} className="text-pro shrink-0" strokeWidth={3} />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
              {(currentPeriodEnd || cancelAtPeriodEnd) && (
                <p className="text-[11px] text-[#8a8a8a] mb-4">
                  {cancelAtPeriodEnd
                    ? `Cancels ${currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : "at period end"}.`
                    : currentPeriodEnd
                      ? `Renews ${new Date(currentPeriodEnd).toLocaleDateString()}.`
                      : ""}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-[#8a8a8a] mt-1 mb-4">
              Streak Armor, H2H challenges, full leagues, advanced analytics, featured programs.
            </p>
          )}
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
            <p className="mt-3 label-cap text-[10px] text-pro/80">Status: {proStatus}</p>
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

      <section className="px-5 pb-10 flex flex-col items-center gap-2">
        <div className="flex justify-center gap-4 label-cap text-[10px] text-grit-dim">
          <Link to="/privacy" className="tap-44">
            Privacy
          </Link>
          <span>·</span>
          <Link to="/terms" className="tap-44">
            Terms
          </Link>
          <span>·</span>
          <Link to="/disclaimer" className="tap-44">
            Disclaimer
          </Link>
        </div>
        <p className="label-cap text-[10px] text-grit-dim">DEADSET — made by Theo Jandhyala</p>
      </section>

      {showStreakShare && (
        <StreakShareCard
          streak={streak}
          displayName={p.displayName || p.username || "Athlete"}
          username={p.username}
          onClose={() => setShowStreakShare(false)}
        />
      )}
    </div>
  );
}

function prUnit(def: PRDef) {
  return def.kind === "1RM" ? "kg" : def.kind === "REPS" ? "reps" : "sec";
}

function PRRow({
  def,
  pr,
  onEdit,
}: {
  def: PRDef;
  pr?: { value: number; reps?: number };
  onEdit: () => void;
}) {
  const unit = prUnit(def);
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left hover:bg-white/[0.03] transition-colors"
    >
      <p className="text-sm font-bold text-grit truncate">{def.label}</p>
      <div className="flex items-center gap-2 shrink-0">
        {pr ? (
          <span className="display text-lg font-extrabold text-grit leading-none">
            {pr.value}
            <span className="label-cap text-[10px] text-grit-dim ml-1">{unit}</span>
            {def.kind === "1RM" && (pr.reps ?? 1) > 1 && (
              <span className="text-[10px] font-bold text-grit-dim ml-1">×{pr.reps}</span>
            )}
          </span>
        ) : (
          <span className="label-cap text-[10px] text-grit-dim">Add PR</span>
        )}
        <Pencil size={12} className="text-grit-dim" />
      </div>
    </button>
  );
}

/** Bottom-sheet popup for entering / updating a PR. */
function PREditSheet({
  def,
  pr,
  onSave,
  onClose,
}: {
  def: PRDef;
  pr?: { value: number; reps?: number };
  onSave: (value: number, reps?: number) => void;
  onClose: () => void;
}) {
  // DOM-owned inputs (defaultValue + ref); a shadow copy drives the live
  // validation UI only. Controlled value/onChange freezes typing in the iOS
  // WKWebView — the reason PR editing appeared broken.
  const valRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const [shadowVal, setShadowVal] = useState(pr ? String(pr.value) : "");
  const unit = prUnit(def);
  const n = Number(shadowVal);
  const valid = Number.isFinite(n) && n > 0;
  const isImprovement = valid && (!pr || n > pr.value);

  function save() {
    const raw = Number(valRef.current?.value ?? "");
    if (!Number.isFinite(raw) || raw <= 0) return;
    const r =
      def.kind === "1RM" ? Math.max(1, Math.round(Number(repsRef.current?.value)) || 1) : undefined;
    onSave(raw, r);
    onClose();
  }

  async function remove() {
    const ok = await askConfirm({
      title: `Remove ${def.label} PR?`,
      message: "This clears your saved best for this lift.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    onSave(0);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-grit-card border rounded-t-3xl rounded-b-none p-6 animate-slide-up"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={14} className="text-accent-red" />
          <span className="label-cap text-[10px] text-accent-red">
            {pr ? "Update PR" : "New PR"}
          </span>
        </div>
        <h2 className="display text-2xl font-extrabold uppercase text-grit leading-tight">
          {def.label}
        </h2>
        <p className="text-xs text-grit-dim mt-1">
          {pr
            ? `Current best: ${pr.value} ${unit}${def.kind === "1RM" && (pr.reps ?? 1) > 1 ? ` × ${pr.reps}` : ""}`
            : "No record yet — set your first one."}
        </p>

        <div className="mt-5 flex items-end gap-3">
          <div className="flex-1">
            <p className="label-cap text-[10px] mb-1.5">{def.kind === "1RM" ? "Weight" : "Best"}</p>
            <div className="relative">
              <input
                ref={valRef}
                autoFocus
                defaultValue={pr ? String(pr.value) : ""}
                onChange={(e) => setShadowVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
                inputMode="decimal"
                placeholder="0"
                className="input-grit text-right pr-12 text-lg font-extrabold"
                aria-label={`${def.label} value`}
              />
              <span className="label-cap text-[10px] text-grit-dim absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {unit}
              </span>
            </div>
          </div>
          {def.kind === "1RM" && (
            <div className="w-24">
              <p className="label-cap text-[10px] mb-1.5">Reps</p>
              <input
                ref={repsRef}
                defaultValue={pr?.reps ? String(pr.reps) : "1"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
                inputMode="numeric"
                placeholder="1"
                className="input-grit text-right text-lg font-extrabold"
                aria-label="Reps"
              />
            </div>
          )}
        </div>

        {valid && !isImprovement && pr && n < pr.value && (
          <p className="text-[11px] text-grit-dim mt-2">
            Heads up — that's below your current best of {pr.value} {unit}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost py-3">
            Cancel
          </button>
          <button onClick={save} disabled={!valid} className="btn-grit py-3 disabled:opacity-40">
            Save PR
          </button>
        </div>
        {pr && (
          <button
            onClick={remove}
            className="w-full mt-3 py-2.5 label-cap text-[11px] text-accent-red hover:bg-accent-red/10 rounded-xl transition-colors"
          >
            Remove this PR
          </button>
        )}
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
