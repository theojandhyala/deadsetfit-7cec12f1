import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ScanBarcode, Droplets, Bell, BellOff, Trash2, Target, Utensils, ShieldCheck, CalendarDays } from "lucide-react";

import { useAppState, getState } from "@/lib/storage";
import { toast } from "sonner";
import { calculateCalories, calculateMacros, isoDay } from "@/lib/calc";
import { lookupBarcode } from "@/lib/diet.functions";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { Lock } from "lucide-react";
import type { FoodLogItem } from "@/lib/types";

export const Route = createFileRoute("/_tabs/diet")({
  head: () => ({ meta: [{ title: "DEADSET — Diet" }] }),
  component: DietPage,
});

function DietPage() {
  const [state, set] = useAppState();
  const barcode = lookupBarcode;

  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [barcodeLoad, setBarcodeLoad] = useState(false);

  const profile = state.profile;
  const calories = useMemo(() => profile ? calculateCalories(profile) : 0, [profile]);
  const macros = useMemo(() => profile ? calculateMacros(profile, calories) : { protein: 0, carbs: 0, fats: 0 }, [profile, calories]);

  const today = isoDay();
  const eaten = state.foodLog.filter((f) => f.date === today);
  const totals = eaten.reduce((a, f) => ({ c: a.c + f.calories, p: a.p + f.protein, ca: a.ca + f.carbs, fa: a.fa + f.fats }), { c:0, p:0, ca:0, fa:0 });
  const waterToday = state.water.filter(w => w.date === today).reduce((s, w) => s + w.ml, 0);

  const { isPro, loading: proLoading } = usePro();
  const nutritionLocked = !proLoading && !isPro;

  // Advanced nutrition: last-7-day aggregates from the food log (Pro).
  const week = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return isoDay(d);
    });
    const perDay = days.map((day) => {
      const items = state.foodLog.filter((f) => f.date === day);
      return items.reduce(
        (a, f) => ({ c: a.c + f.calories, p: a.p + f.protein, ca: a.ca + f.carbs, fa: a.fa + f.fats, logged: true }),
        { c: 0, p: 0, ca: 0, fa: 0, logged: items.length > 0 },
      );
    });
    const loggedDays = perDay.filter((d) => d.logged);
    const n = Math.max(1, loggedDays.length);
    const avg = {
      c: Math.round(loggedDays.reduce((s, d) => s + d.c, 0) / n),
      p: Math.round(loggedDays.reduce((s, d) => s + d.p, 0) / n),
      ca: Math.round(loggedDays.reduce((s, d) => s + d.ca, 0) / n),
      fa: Math.round(loggedDays.reduce((s, d) => s + d.fa, 0) / n),
    };
    const calHits = perDay.filter((d) => d.logged && d.c >= calories * 0.9 && d.c <= calories * 1.12).length;
    const proteinHits = perDay.filter((d) => d.logged && d.p >= macros.protein * 0.9).length;
    const macroKcal = avg.p * 4 + avg.ca * 4 + avg.fa * 9;
    const split = macroKcal > 0
      ? {
          p: Math.round(((avg.p * 4) / macroKcal) * 100),
          ca: Math.round(((avg.ca * 4) / macroKcal) * 100),
          fa: Math.round(((avg.fa * 9) / macroKcal) * 100),
        }
      : null;
    const proteinPerKg = profile?.weightKg ? Math.round((avg.p / profile.weightKg) * 100) / 100 : null;
    return { avg, calHits, proteinHits, split, proteinPerKg, loggedDays: loggedDays.length };
  }, [state.foodLog, calories, macros.protein, profile?.weightKg]);

  // Hydration alerts — in-app nudge when behind pace during waking hours.
  // Checks every 5 min but nudges at most every 90 min (localStorage stamp);
  // deps stay minimal so re-renders don't reset the interval (state.water is
  // a fresh array identity every render — reading via getState() avoids it).
  const hydrationOn = state.hydrationAlertsEnabled;
  useEffect(() => {
    if (!hydrationOn) return;
    const NUDGE_KEY = "deadset_hydration_nudge_at";
    const id = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 8 || hour > 22) return;
      const last = Number(localStorage.getItem(NUDGE_KEY) || 0);
      if (Date.now() - last < 90 * 60 * 1000) return;
      const fresh = getState();
      const elapsed = (hour - 8) / 14;
      const target = (fresh.waterTargetMl ?? 3000) * elapsed;
      const day = isoDay();
      const wt = fresh.water.filter((w) => w.date === day).reduce((s, w) => s + w.ml, 0);
      if (wt < target - 300) {
        localStorage.setItem(NUDGE_KEY, String(Date.now()));
        toast("Hydration check", {
          description: `${Math.round((target - wt) / 100) * 100}ml behind pace — grab some water.`,
        });
        const el = document.getElementById("water-ring");
        if (el) {
          el.classList.add("animate-pulse");
          setTimeout(() => el.classList.remove("animate-pulse"), 4000);
        }
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [hydrationOn]);

  function addFood() {
    if (!name) return;
    const item: FoodLogItem = {
      date: today,
      name,
      calories: Number(cals) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      source: "manual",
    };
    set((s) => ({ ...s, foodLog: [...s.foodLog, item] }));
    setName(""); setCals(""); setProtein(""); setCarbs(""); setFats("");
  }

  function addPresetFood(item: Omit<FoodLogItem, "date" | "source">) {
    set((s) => ({ ...s, foodLog: [...s.foodLog, { ...item, date: today, source: "manual" }] }));
  }

  function removeFood(idx: number) {
    const day = isoDay();
    set((s) => {
      const todayIndices = s.foodLog.reduce<number[]>((acc, f, i) => { if (f.date === day) acc.push(i); return acc; }, []);
      const targetIndex = todayIndices[idx];
      if (targetIndex === undefined) return s;
      return { ...s, foodLog: s.foodLog.filter((_, i) => i !== targetIndex) };
    });
  }

  async function doBarcode() {
    if (!barcodeVal) return;
    setBarcodeLoad(true); setError(null); setRetryAction(null);
    try {
      const r = await barcode({ data: { barcode: barcodeVal } });
      const item: FoodLogItem = {
        date: today, name: `${r.name} (${r.serving})`,
        calories: r.calories, protein: r.protein, carbs: r.carbs, fats: r.fats,
        source: "barcode",
      };
      set((s) => ({ ...s, foodLog: [...s.foodLog, item] }));
      setBarcodeVal(""); setBarcodeOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lookup failed";
      setError(msg);
      setRetryAction(() => doBarcode);
      // The banner lives at the top of the page; the barcode input is at the
      // bottom — surface the failure where the user actually is.
      toast.error(`Barcode lookup failed — ${msg}`);
    }
    finally { setBarcodeLoad(false); }
  }

  function logWater(ml: number) {
    set((s) => ({ ...s, water: [...s.water, { date: today, ml, at: new Date().toISOString() }] }));
  }
  function undoWater() {
    set((s) => {
      const idx = [...s.water].reverse().findIndex(w => w.date === today);
      if (idx < 0) return s;
      const realIdx = s.water.length - 1 - idx;
      return { ...s, water: s.water.filter((_, i) => i !== realIdx) };
    });
  }

  const supps = supplementsFor(profile?.goal);
  const waterPct = Math.min(1, waterToday / Math.max(state.waterTargetMl, 1));
  const caloriePct = Math.min(1, totals.c / Math.max(calories, 1));
  const proteinPct = Math.min(1, totals.p / Math.max(macros.protein, 1));
  const dietScore = Math.round(((caloriePct > 0.9 && caloriePct < 1.12 ? 40 : caloriePct * 35) + proteinPct * 40 + waterPct * 20));
  const remainingCalories = Math.max(0, calories - totals.c);
  const remainingProtein = Math.max(0, macros.protein - Math.round(totals.p));
  const calorieDelta = totals.c - calories;
  const isCut = profile?.goal === "CUT";
  const isBulk = profile?.goal === "BULK";
  const nextMeal = nextMealAdvice(profile?.goal, remainingCalories, remainingProtein, calories);
  const goalPlan = goalDietPlan(profile?.goal, calories, macros.protein, remainingCalories, remainingProtein);
  const presets = presetFoodsFor(profile?.goal);
  const calorieGrid = useMemo(
    () => buildCalorieGoalGrid(state.foodLog, calories, profile?.goal),
    [state.foodLog, calories, profile?.goal],
  );

  // BMI + per-meal breakdown
  const bmi = profile ? profile.weightKg / Math.pow(profile.heightCm / 100, 2) : 0;
  const bmiBand =
    bmi < 18.5 ? "UNDER" :
    bmi < 25 ? "HEALTHY" :
    bmi < 30 ? "OVER" : "OBESE";
  const goalCue =
    profile?.goal === "CUT" ? "Calorie deficit — lean out" :
    profile?.goal === "BULK" ? "Calorie surplus — build mass" :
    profile?.goal === "ATHLETIC" ? "Slight surplus — fuel performance" :
    "Maintenance — hold weight";
  const perMeal = {
    cal: Math.round(calories / 4),
    p: Math.round(macros.protein / 4),
    c: Math.round(macros.carbs / 4),
    f: Math.round(macros.fats / 4),
  };

  return (
    <div className="deadset-page">
      <header className="deadset-section">
        <div className="deadset-hero-card p-5">
          <div className="relative">
            <p className="label-cap text-accent-red">Fuel dashboard</p>
            <div className="flex items-end justify-between gap-4 mt-2">
              <div>
                <div className="display text-[4rem] font-black text-grit leading-none">
                  {remainingCalories}
                  <span className="text-xl text-[#8a8a8a] ml-2">KCAL</span>
                </div>
                <p className="text-sm text-[#8a8a8a] mt-2">
                  left today · {totals.c} eaten from {calories}
                </p>
              </div>
              <div className="deadset-glass-strip rounded-2xl px-3 py-2 text-right shrink-0">
                <p className="label-cap text-[8px]">Score</p>
                <p className="display text-3xl font-black text-grit leading-none">
                  {Math.min(100, dietScore)}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <ProgressLine label="Calories" value={totals.c} target={calories} color="#f5f5f0" unit="kcal" />
              <ProgressLine label="Protein" value={Math.round(totals.p)} target={macros.protein} color="#e63222" unit="g" />
              <ProgressLine label="Water" value={waterToday} target={state.waterTargetMl} color="#3b9eff" unit="ml" />
            </div>
          </div>
        </div>
      </header>

      <section className="deadset-section">
        <CalorieGoalGrid
          days={calorieGrid.days}
          streak={calorieGrid.streak}
          hitCount={calorieGrid.hitCount}
          target={calories}
          goal={profile?.goal}
        />
      </section>

      {/* Advanced Nutrition (Pro) */}
      <section className="deadset-section">
        <div className="bg-grit-card border border-grit rounded-2xl p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <p className="label-cap text-[10px] text-accent-red">ADVANCED NUTRITION · 7 DAYS</p>
            <span className="label-cap text-[9px] text-accent-red border border-accent-red/40 rounded px-1.5">
              PRO
            </span>
          </div>
          <div
            className={
              nutritionLocked ? "pointer-events-none select-none blur-[6px] opacity-60" : undefined
            }
            aria-hidden={nutritionLocked || undefined}
          >
            {week.loggedDays === 0 ? (
              <p className="text-xs text-grit-dim">
                Log food for a few days and your weekly averages appear here.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-grit rounded-xl p-3">
                    <p className="label-cap text-[9px] text-grit-dim">AVG CALORIES</p>
                    <p className="display text-xl font-extrabold text-grit">
                      {week.avg.c}
                      <span className="text-[10px] text-grit-dim ml-1">/ {calories}</span>
                    </p>
                  </div>
                  <div className="border border-grit rounded-xl p-3">
                    <p className="label-cap text-[9px] text-grit-dim">AVG PROTEIN</p>
                    <p className="display text-xl font-extrabold text-grit">
                      {week.avg.p}g
                      {week.proteinPerKg !== null && (
                        <span className="text-[10px] text-grit-dim ml-1">
                          {week.proteinPerKg}g/kg
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="border border-grit rounded-xl p-3">
                    <p className="label-cap text-[9px] text-grit-dim">CALORIE TARGET HIT</p>
                    <p className="display text-xl font-extrabold text-grit">{week.calHits}/7</p>
                  </div>
                  <div className="border border-grit rounded-xl p-3">
                    <p className="label-cap text-[9px] text-grit-dim">PROTEIN TARGET HIT</p>
                    <p className="display text-xl font-extrabold text-grit">{week.proteinHits}/7</p>
                  </div>
                </div>
                {week.split && (
                  <div className="mt-3">
                    <p className="label-cap text-[9px] text-grit-dim mb-1.5">MACRO SPLIT</p>
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div style={{ width: `${week.split.p}%`, background: "#e63222" }} />
                      <div style={{ width: `${week.split.ca}%`, background: "#f5f5f0" }} />
                      <div style={{ width: `${week.split.fa}%`, background: "#8a8a8a" }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[9px] label-cap text-grit-dim">
                      <span>
                        <span className="text-accent-red">●</span> Protein {week.split.p}%
                      </span>
                      <span>
                        <span className="text-grit">●</span> Carbs {week.split.ca}%
                      </span>
                      <span>● Fats {week.split.fa}%</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {nutritionLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="bg-grit-card border p-4 max-w-[260px] text-center">
                <Lock size={16} className="text-accent-red mx-auto mb-2" />
                <p className="label-cap text-[10px] mb-1">ADVANCED NUTRITION</p>
                <p className="text-xs text-grit-dim mb-3">
                  Weekly averages, macro split and protein per kg.
                </p>
                <button
                  onClick={() => openPaywall("nutrition")}
                  className="btn-grit px-4 py-2 text-xs"
                >
                  UNLOCK WITH PRO
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="deadset-section">
        <div className="bg-grit-card border border-grit rounded-2xl p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="label-cap text-[10px] text-accent-red">TODAY'S DIET SCORE</p>
              <p className="display text-5xl font-extrabold text-grit leading-none mt-1">{Math.min(100, dietScore)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <ProgressLine label="Calories" value={totals.c} target={calories} color="#f5f5f0" unit="kcal" />
            <ProgressLine label="Protein" value={Math.round(totals.p)} target={macros.protein} color="#e63222" unit="g" />
            <ProgressLine label="Water" value={waterToday} target={state.waterTargetMl} color="#3b9eff" unit="ml" />
          </div>
        </div>
      </section>

      {profile && (
        <section className="deadset-section">
          <div className="bg-grit-card border border-accent-red/70 rounded-2xl p-4 overflow-hidden relative">
            <div className="absolute -right-10 -top-16 h-36 w-36 rounded-full bg-accent-red/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-cap text-accent-red flex items-center gap-2">
                    <Target size={13} /> {isCut ? "Cut coach" : isBulk ? "Bulk coach" : "Nutrition coach"}
                  </p>
                  <h2 className="display text-3xl font-extrabold text-grit leading-none mt-2">
                    {goalPlan.title}
                  </h2>
                  <p className="text-sm text-grit-dim mt-2 leading-relaxed">{goalPlan.body}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="label-cap text-[9px] text-grit-dim">Left</p>
                  <p className="display text-2xl font-extrabold text-grit leading-none">{remainingCalories}</p>
                  <p className="label-cap text-[9px] text-grit-dim mt-1">kcal</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <CoachStat label="Protein left" value={`${remainingProtein}g`} tone={remainingProtein > 40 ? "red" : "white"} />
                <CoachStat label={calorieDelta > 0 ? "Over target" : "Cal buffer"} value={calorieDelta > 0 ? `+${calorieDelta}` : String(remainingCalories)} tone={calorieDelta > 0 && isCut ? "red" : "white"} />
                <CoachStat label="Water left" value={`${Math.max(0, state.waterTargetMl - waterToday)}ml`} tone="blue" />
              </div>

              <div className="mt-4 border border-grit bg-[#080808] rounded-2xl p-3">
                <p className="label-cap text-[10px] text-grit-dim flex items-center gap-2"><Utensils size={12} /> Next best move</p>
                <p className="text-sm text-grit mt-1 font-bold">{nextMeal.title}</p>
                <p className="text-xs text-grit-dim mt-1 leading-relaxed">{nextMeal.body}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                {goalPlan.rules.map((rule) => (
                  <div key={rule} className="border border-grit bg-[#101010] rounded-xl px-2 py-2">
                    <ShieldCheck size={13} className="text-accent-red mx-auto mb-1" />
                    <p className="label-cap text-[8px] text-grit leading-tight">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== QUICK ACTIONS — log a meal fast ===== */}
      <div className="deadset-section">
        <p className="label-cap text-[10px] text-[#8a8a8a] mb-2">Log a meal</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setBarcodeOpen(true); const el = document.getElementById("food-log-section"); el?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            className="btn-grit py-3 flex flex-col items-center justify-center gap-1 text-[10px]"
          >
            <ScanBarcode size={16} />
            <span className="label-cap">Barcode</span>
          </button>
          <button
            onClick={() => { const el = document.getElementById("food-log-section"); el?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            className="btn-ghost py-3 flex flex-col items-center justify-center gap-1 text-[10px]"
          >
            <Plus size={16} />
            <span className="label-cap">Manual</span>
          </button>
        </div>
        {error && (
          <div className="mt-2 border border-accent-red bg-accent-red/10 p-3 rounded-2xl">
            <p className="text-xs text-accent-red">{error}</p>
            {retryAction && (
              <button onClick={retryAction} className="btn-grit mt-2 w-full py-2 text-[11px]">
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* BMI + per-meal breakdown */}
      {profile && (
        <div className="deadset-section">
          <div className="bg-grit-card border border-grit rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="label-cap text-[10px] text-[#8a8a8a]">Your numbers</p>
                <p className="text-xs text-grit mt-1">
                  BMI <span className="display font-extrabold text-grit">{bmi.toFixed(1)}</span>
                  <span className="text-[#8a8a8a] ml-1.5">({bmiBand})</span>
                  <span className="text-[#8a8a8a] mx-1.5">·</span>
                  {profile.weightKg}kg · {profile.heightCm}cm
                </p>
                <p className="text-[10px] text-accent-red label-cap mt-1">{goalCue}</p>
              </div>
            </div>
            <p className="label-cap text-[10px] text-[#8a8a8a] mb-2">Eat per meal (× 4 meals)</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="border border-grit p-2">
                <p className="display font-extrabold text-grit text-base leading-none">{perMeal.cal}</p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">KCAL</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#e63222" }}>{perMeal.p}g</p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">PROTEIN</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#fbbf24" }}>{perMeal.c}g</p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">CARBS</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#22c55e" }}>{perMeal.f}g</p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">FATS</p>
              </div>
            </div>
            <p className="text-[10px] text-[#8a8a8a] mt-2 leading-snug">
              Aim for ~<span className="text-grit">{Math.round(profile.weightKg * (profile.goal === "CUT" ? 2.4 : profile.goal === "ATHLETIC" ? 2.2 : 2.0))}g protein/day</span> ({(profile.goal === "CUT" ? 2.4 : profile.goal === "ATHLETIC" ? 2.2 : 2.0).toFixed(1)}g per kg bodyweight) and <span className="text-grit">{state.waterTargetMl}ml water</span>.
            </p>
          </div>
        </div>
      )}

      {/* Macro ring */}
      <div className="deadset-section">
        <MacroRing protein={macros.protein} carbs={macros.carbs} fats={macros.fats}
          pEaten={totals.p} cEaten={totals.ca} fEaten={totals.fa} />
      </div>

      {/* Hydration */}
      <section className="deadset-section">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap flex items-center gap-2"><Droplets size={12} /> Hydration</p>
          <button
            onClick={() => set(s => ({ ...s, hydrationAlertsEnabled: !s.hydrationAlertsEnabled }))}
            className="label-cap text-[#8a8a8a] flex items-center gap-1"
            title={state.hydrationAlertsEnabled ? "Alerts on" : "Alerts off"}
          >
            {state.hydrationAlertsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
            {state.hydrationAlertsEnabled ? "Alerts on" : "Off"}
          </button>
        </div>
        <div className="bg-grit-card border border-grit p-4 flex items-center gap-4">
          <div id="water-ring" className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#262626" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#3b9eff" strokeWidth="8"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - waterPct)}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center display font-extrabold text-grit text-sm">
              {Math.round(waterPct * 100)}%
            </div>
          </div>
          <div className="flex-1">
            <p className="display font-extrabold text-grit text-xl leading-none">{waterToday}<span className="text-sm text-[#8a8a8a] ml-1">/ {state.waterTargetMl} ML</span></p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={() => logWater(250)} className="btn-ghost text-xs px-3 py-1.5">+250</button>
              <button onClick={() => logWater(500)} className="btn-ghost text-xs px-3 py-1.5">+500</button>
              <button onClick={() => logWater(750)} className="btn-ghost text-xs px-3 py-1.5">+750</button>
              <button onClick={undoWater} className="btn-ghost text-xs px-3 py-1.5 text-[#8a8a8a]">Undo</button>
            </div>
          </div>
        </div>
      </section>

      {/* Food log */}
      <section id="food-log-section" className="deadset-section">
        <p className="label-cap mb-2">Food Log</p>
        <div className="bg-grit-card border border-grit p-4">
          <p className="label-cap text-[10px] text-grit-dim mb-2">Fast add</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ...presets,
            ].map((p) => (
              <button
                key={p.name}
                onClick={() => addPresetFood(p)}
                className="border border-grit bg-[#080808] p-2 text-left"
              >
                <p className="text-xs font-bold text-grit truncate">{p.name}</p>
                <p className="text-[10px] text-grit-dim mt-0.5">{p.calories} kcal · P{p.protein}</p>
              </button>
            ))}
          </div>

          {/* Quick input row */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food" className="input-grit col-span-2" />
            <input inputMode="numeric" value={cals} onChange={(e) => setCals(e.target.value.replace(/[^0-9]/g, ""))} placeholder="kcal (optional)" className="input-grit" />
            <input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^0-9]/g, ""))} placeholder="protein g" className="input-grit" />
            <input inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value.replace(/[^0-9]/g, ""))} placeholder="carbs g" className="input-grit" />
            <input inputMode="numeric" value={fats} onChange={(e) => setFats(e.target.value.replace(/[^0-9]/g, ""))} placeholder="fats g" className="input-grit" />
          </div>
          <button onClick={addFood} className="btn-grit w-full mb-3 gap-2"><Plus size={16} /> Add food</button>

          {isCut && (
            <div className="mb-3 rounded-2xl border border-grit bg-[#080808] p-3 text-xs text-grit-dim leading-relaxed">
              <span className="text-grit font-bold">Cut tip:</span> if you’re unsure, log the meal slightly higher and protect protein. Fat loss works best when tracking is simple and honest, not perfect.
            </div>
          )}

          {/* Barcode lookup */}
          <button
            onClick={() => setBarcodeOpen(v => !v)}
            className="btn-ghost w-full py-2.5 mb-3 flex items-center justify-center gap-2 text-xs"
          >
            <ScanBarcode size={14} /> {barcodeOpen ? "Hide barcode lookup" : "Barcode lookup"}
          </button>

          {barcodeOpen && (
            <div className="flex gap-2 mb-3">
              <input
                value={barcodeVal}
                onChange={(e) => setBarcodeVal(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter barcode digits"
                inputMode="numeric"
                className="input-grit flex-1"
              />
              <button onClick={doBarcode} disabled={barcodeLoad || !barcodeVal} className="btn-grit px-3">
                {barcodeLoad ? <Loader2 size={14} className="animate-spin" /> : "Find"}
              </button>
            </div>
          )}

          {eaten.length === 0 && <p className="text-xs text-[#8a8a8a]">Nothing logged yet today.</p>}
          {eaten.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-2 border-t border-grit first:border-t-0">
              <div className="w-9 h-9 bg-[#1a1a1a] border border-grit flex items-center justify-center flex-shrink-0">
                {f.source === "barcode" ? <ScanBarcode size={12} className="text-[#8a8a8a]" /> :
                 <span className="label-cap text-[8px] text-[#8a8a8a]">M</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-grit truncate">{f.name}</p>
                <p className="text-[10px] text-[#8a8a8a]">P{f.protein} · C{f.carbs} · F{f.fats}</p>
              </div>
              <span className="text-sm text-[#8a8a8a] font-bold">{f.calories}</span>
              <button onClick={() => removeFood(i)} className="text-[#8a8a8a] p-1"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Supplements */}
      <section className="deadset-section mb-8">
        <p className="label-cap mb-2">Supplements</p>
        <div className="bg-grit-card border border-grit">
          {supps.map((s) => (
            <div key={s.name} className="px-4 py-3 border-b border-grit last:border-b-0">
              <div className="font-bold uppercase text-sm text-grit">{s.name}</div>
              <div className="text-xs text-[#8a8a8a]">{s.note}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoachStat({ label, value, tone }: { label: string; value: string; tone: "red" | "white" | "blue" }) {
  const color = tone === "red" ? "#e63222" : tone === "blue" ? "#3b9eff" : "#f5f5f0";
  return (
    <div className="border border-grit bg-[#080808] rounded-xl px-2 py-3 text-center">
      <p className="display font-extrabold text-xl leading-none" style={{ color }}>{value}</p>
      <p className="label-cap text-[8px] text-grit-dim mt-1 leading-tight">{label}</p>
    </div>
  );
}

type CalorieGoalDay = {
  date: string;
  dayLabel: string;
  calories: number;
  hit: boolean;
  logged: boolean;
  isToday: boolean;
};

function CalorieGoalGrid({
  days,
  streak,
  hitCount,
  target,
  goal,
}: {
  days: CalorieGoalDay[];
  streak: number;
  hitCount: number;
  target: number;
  goal?: string;
}) {
  const rule =
    goal === "CUT"
      ? "85–100% target"
      : goal === "BULK"
        ? "95–115% target"
        : "90–110% target";
  return (
    <div className="deadset-card-soft p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="label-cap text-accent-red flex items-center gap-2">
            <CalendarDays size={13} /> Calorie consistency
          </p>
          <h2 className="display text-2xl font-black uppercase text-grit leading-none mt-1">
            {streak} day streak
          </h2>
          <p className="text-xs text-grit-dim mt-2">
            Red dots mean you hit your calorie goal. Aim for {rule}.
          </p>
        </div>
        <div className="deadset-glass-strip rounded-2xl px-3 py-2 text-right shrink-0">
          <p className="label-cap text-[8px]">28 days</p>
          <p className="display text-2xl font-black text-grit leading-none">
            {hitCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span
              title={`${day.date}: ${day.calories} / ${target} kcal`}
              className="h-6 w-6 rounded-full transition-all"
              style={{
                background: day.hit
                  ? "radial-gradient(circle at 35% 30%, #ff756a, #e63222 58%, #7a130c)"
                  : day.logged
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.045)",
                border: day.isToday
                  ? "2px solid #f5f5f0"
                  : day.hit
                    ? "1px solid rgba(230,50,34,0.72)"
                    : "1px solid rgba(255,255,255,0.08)",
                boxShadow: day.hit ? "0 0 18px rgba(230,50,34,0.34)" : "none",
                opacity: day.isToday || day.logged ? 1 : 0.72,
              }}
            />
            <span
              className="label-cap text-[7px]"
              style={{ color: day.isToday ? "#f5f5f0" : "#6f6f6f" }}
            >
              {day.dayLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildCalorieGoalGrid(
  foodLog: FoodLogItem[],
  targetCalories: number,
  goal?: string,
): { days: CalorieGoalDay[]; streak: number; hitCount: number } {
  const dates = lastNDays(28);
  const today = isoDay();
  const days = dates.map((date) => {
    const items = foodLog.filter((item) => item.date === date);
    const calories = items.reduce((sum, item) => sum + item.calories, 0);
    const hit = caloriesHitGoal(calories, targetCalories, goal);
    const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
    return {
      date,
      dayLabel: label,
      calories,
      hit,
      logged: items.length > 0,
      isToday: date === today,
    };
  });

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].hit) break;
    streak += 1;
  }

  return {
    days,
    streak,
    hitCount: days.filter((day) => day.hit).length,
  };
}

function caloriesHitGoal(calories: number, targetCalories: number, goal?: string) {
  if (!calories || !targetCalories) return false;
  const ratio = calories / targetCalories;
  if (goal === "CUT") return ratio >= 0.85 && ratio <= 1;
  if (goal === "BULK") return ratio >= 0.95 && ratio <= 1.15;
  return ratio >= 0.9 && ratio <= 1.1;
}

function goalDietPlan(goal: string | undefined, calories: number, protein: number, remainingCalories: number, remainingProtein: number) {
  if (goal === "CUT") {
    return {
      title: "Lose fat without guessing.",
      body: `${remainingCalories} kcal and ${remainingProtein}g protein left today. Stay close to ${calories} kcal, keep meals high-protein, and use low-calorie volume foods when hunger kicks in.`,
      rules: [`${protein}g protein`, "High volume", "No drink cals"],
    };
  }
  if (goal === "BULK") {
    return {
      title: "Build size without junk weight.",
      body: `${remainingCalories} kcal left today. Push calories up with carbs around training, keep protein steady, and do not let a bulk become random snacking.`,
      rules: [`${protein}g protein`, "Carbs pre/post", "Track weight"],
    };
  }
  if (goal === "ATHLETIC") {
    return {
      title: "Fuel performance.",
      body: `${remainingCalories} kcal left today. Prioritise protein, hydration, and carbs around hard sessions so training output stays high.`,
      rules: [`${protein}g protein`, "Hydrate", "Carb timing"],
    };
  }
  return {
    title: "Hold the line.",
    body: `${remainingCalories} kcal and ${remainingProtein}g protein left today. Keep weight stable by landing near target and hitting protein most days.`,
    rules: [`${protein}g protein`, "Stay stable", "Water daily"],
  };
}

function nextMealAdvice(goal: string | undefined, remainingCalories: number, remainingProtein: number, targetCalories: number) {
  const lowCalories = remainingCalories < targetCalories * 0.22;
  if (remainingProtein > 45 && lowCalories) {
    return {
      title: "Go lean protein next.",
      body: "Choose chicken, tuna, eggs, prawns, Greek yoghurt or a shake. Keep sauces and oils light so you can hit protein without blowing calories.",
    };
  }
  if (goal === "CUT") {
    return {
      title: remainingCalories > 650 ? "Build a filling cut meal." : "Keep the next meal tight.",
      body: remainingCalories > 650
        ? "Aim for lean protein + veg/salad + one controlled carb. Example: chicken, potatoes and veg."
        : "Use a lighter protein option now. Example: yoghurt bowl, shake, tuna salad, omelette or chicken salad.",
    };
  }
  if (goal === "BULK") {
    return {
      title: "Use the calories properly.",
      body: "Pair protein with easy carbs. Example: chicken rice bowl, oats + whey, pasta with lean mince, or eggs on toast.",
    };
  }
  return {
    title: "Balance the next plate.",
    body: "Aim for protein first, then add carbs/fats based on what is still missing from today’s targets.",
  };
}

function presetFoodsFor(goal?: string): Array<Omit<FoodLogItem, "date" | "source">> {
  if (goal === "CUT") {
    return [
      { name: "Chicken Salad Bowl", calories: 360, protein: 42, carbs: 18, fats: 10 },
      { name: "Greek Yoghurt + Berries", calories: 190, protein: 22, carbs: 20, fats: 2 },
      { name: "Tuna Rice Cakes", calories: 260, protein: 32, carbs: 24, fats: 3 },
      { name: "Protein Shake", calories: 180, protein: 30, carbs: 6, fats: 3 },
    ];
  }
  if (goal === "BULK") {
    return [
      { name: "Chicken + Rice", calories: 620, protein: 48, carbs: 82, fats: 9 },
      { name: "Oats + Whey", calories: 520, protein: 38, carbs: 68, fats: 12 },
      { name: "Eggs + Toast", calories: 430, protein: 26, carbs: 35, fats: 20 },
      { name: "Lean Mince Pasta", calories: 720, protein: 52, carbs: 86, fats: 16 },
    ];
  }
  return [
    { name: "Protein Shake", calories: 180, protein: 30, carbs: 6, fats: 3 },
    { name: "Chicken + Rice", calories: 520, protein: 45, carbs: 62, fats: 8 },
    { name: "Greek Yoghurt", calories: 160, protein: 18, carbs: 12, fats: 4 },
    { name: "Eggs + Toast", calories: 430, protein: 26, carbs: 35, fats: 20 },
  ];
}

function ProgressLine({ label, value, target, color, unit }: { label: string; value: number; target: number; color: string; unit: string }) {
  const pct = Math.min(1, value / Math.max(target, 1));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] label-cap mb-1">
        <span className="text-grit-dim">{label}</span>
        <span className="text-grit">{value} / {target} {unit}</span>
      </div>
      <div className="h-2 bg-[#050505] border border-grit overflow-hidden">
        <div className="h-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function supplementsFor(goal?: string) {
  const base = [
    { name: "Whey Protein", note: "1 scoop post-workout to hit protein target." },
    { name: "Creatine Monohydrate", note: "5g daily, any time." },
    { name: "Vitamin D3", note: "2000 IU daily with food." },
  ];
  if (goal === "BULK") base.push({ name: "Mass Gainer (optional)", note: "If struggling to hit calories." });
  if (goal === "CUT") base.push({ name: "Caffeine", note: "200mg pre-workout for output during deficit." });
  if (goal === "ATHLETIC") base.push({ name: "Beta-Alanine", note: "3-5g daily for anaerobic capacity." });
  return base;
}

function MacroRing({ protein, carbs, fats, pEaten, cEaten, fEaten }: { protein: number; carbs: number; fats: number; pEaten: number; cEaten: number; fEaten: number }) {
  const size = 200, cx = size/2, cy = size/2;
  const items = [
    { color: "#e63222", target: protein, eaten: pEaten, label: "P", radius: 80 },
    { color: "#f5f5f0", target: carbs, eaten: cEaten, label: "C", radius: 64 },
    { color: "#8a8a8a", target: fats, eaten: fEaten, label: "F", radius: 48 },
  ];
  return (
    <div className="bg-grit-card border border-grit p-5 flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {items.map((it) => {
          const c = 2 * Math.PI * it.radius;
          const pct = Math.min(1, it.eaten / Math.max(it.target, 1));
          return (
            <g key={it.label} transform={`rotate(-90 ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r={it.radius} fill="none" stroke="#262626" strokeWidth="8" />
              <circle cx={cx} cy={cy} r={it.radius} fill="none" stroke={it.color} strokeWidth="8"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="butt" />
            </g>
          );
        })}
      </svg>
      <div className="flex-1 space-y-2 text-sm">
        <Row color="#e63222" label="Protein" eaten={pEaten} target={protein} />
        <Row color="#f5f5f0" label="Carbs" eaten={cEaten} target={carbs} />
        <Row color="#8a8a8a" label="Fats" eaten={fEaten} target={fats} />
      </div>
    </div>
  );
}

function Row({ color, label, eaten, target }: { color: string; label: string; eaten: number; target: number }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2" style={{ background: color }} />
        <span className="label-cap" style={{ color }}>{label}</span>
      </div>
      <div className="font-bold text-grit">{eaten}<span className="text-[#8a8a8a] font-normal"> / {target}g</span></div>
    </div>
  );
}
