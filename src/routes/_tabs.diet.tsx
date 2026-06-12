import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Plus,
  Camera,
  ScanBarcode,
  Droplets,
  FileBarChart,
  Bell,
  BellOff,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/lib/storage";
import { calculateCalories, calculateMacros, isoDay } from "@/lib/calc";
import { generateMeals, swapMeal } from "@/lib/ai.functions";
import { analyzeFoodPhoto, lookupBarcode, weeklyNutritionReport } from "@/lib/diet.functions";
import type { Meal, MealPlan, FoodLogItem } from "@/lib/types";

export const Route = createFileRoute("/_tabs/diet")({
  head: () => ({ meta: [{ title: "DEADSET — Diet" }] }),
  component: DietPage,
});

type WeeklyReport = Awaited<ReturnType<typeof weeklyNutritionReport>>;

function DietPage() {
  const [state, set] = useAppState();
  const gen = useServerFn(generateMeals);
  const swap = useServerFn(swapMeal);
  const analyze = useServerFn(analyzeFoodPhoto);
  const barcode = useServerFn(lookupBarcode);
  const report = useServerFn(weeklyNutritionReport);

  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealConstraints, setMealConstraints] = useState("");
  const [name, setName] = useState("");
  const [cals, setCals] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [barcodeLoad, setBarcodeLoad] = useState(false);
  const [reportLoad, setReportLoad] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const profile = state.profile;
  const calories = useMemo(() => (profile ? calculateCalories(profile) : 0), [profile]);
  const macros = useMemo(
    () => (profile ? calculateMacros(profile, calories) : { protein: 0, carbs: 0, fats: 0 }),
    [profile, calories],
  );

  const today = isoDay();
  const eaten = state.foodLog.filter((f) => f.date === today);
  const totals = eaten.reduce(
    (a, f) => ({ c: a.c + f.calories, p: a.p + f.protein, ca: a.ca + f.carbs, fa: a.fa + f.fats }),
    { c: 0, p: 0, ca: 0, fa: 0 },
  );
  const waterToday = state.water.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0);

  // Hydration alerts — gentle nudge every 90 min if behind pace during waking hours
  useEffect(() => {
    if (!state.hydrationAlertsEnabled) return;
    const id = setInterval(
      () => {
        const now = new Date();
        const hour = now.getHours();
        if (hour < 8 || hour > 22) return;
        const elapsed = (hour - 8) / 14;
        const target = state.waterTargetMl * elapsed;
        const wt = state.water.filter((w) => w.date === isoDay()).reduce((s, w) => s + w.ml, 0);
        if (wt < target - 300) {
          // Soft notification via toast-like in-app banner — using alert avoided for UX; we just flash the ring
          const el = document.getElementById("water-ring");
          if (el) {
            el.classList.add("animate-pulse");
            setTimeout(() => el.classList.remove("animate-pulse"), 4000);
          }
        }
      },
      90 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [state.hydrationAlertsEnabled, state.waterTargetMl, state.water]);

  async function loadMeals() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await gen({
        data: {
          goal: profile.goal,
          calories,
          ...macros,
          dislikes: profile.injuries,
          constraints: mealConstraints || undefined,
        },
      });
      set((s) => ({ ...s, mealPlan: res }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function doSwap(key: keyof MealPlan, meal: Meal) {
    setSwapping(key);
    setError(null);
    try {
      const r = await swap({ data: meal });
      set((s) => (s.mealPlan ? { ...s, mealPlan: { ...s.mealPlan, [key]: r } } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSwapping(null);
    }
  }

  function addFood() {
    const c = Number(cals);
    if (!name || !c) return;
    const item: FoodLogItem = {
      date: today,
      name,
      calories: c,
      protein: 0,
      carbs: 0,
      fats: 0,
      source: "manual",
    };
    set((s) => ({ ...s, foodLog: [...s.foodLog, item] }));
    setName("");
    setCals("");
  }

  function removeFood(idx: number) {
    const day = isoDay();
    set((s) => {
      const todayIndices = s.foodLog.reduce<number[]>((acc, f, i) => {
        if (f.date === day) acc.push(i);
        return acc;
      }, []);
      const targetIndex = todayIndices[idx];
      if (targetIndex === undefined) return s;
      return { ...s, foodLog: s.foodLog.filter((_, i) => i !== targetIndex) };
    });
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const dataUrl = await downscale(file, 800);
      const r = await analyze({ data: { imageDataUrl: dataUrl } });
      const item: FoodLogItem = {
        date: today,
        name: r.name,
        calories: Math.round(r.calories),
        protein: Math.round(r.protein),
        carbs: Math.round(r.carbs),
        fats: Math.round(r.fats),
        source: "photo",
        photoThumb: await downscale(file, 120),
      };
      set((s) => ({ ...s, foodLog: [...s.foodLog, item] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo analysis failed");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doBarcode() {
    if (!barcodeVal) return;
    setBarcodeLoad(true);
    setError(null);
    try {
      const r = await barcode({ data: { barcode: barcodeVal } });
      const item: FoodLogItem = {
        date: today,
        name: `${r.name} (${r.serving})`,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fats: r.fats,
        source: "barcode",
      };
      set((s) => ({ ...s, foodLog: [...s.foodLog, item] }));
      setBarcodeVal("");
      setBarcodeOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBarcodeLoad(false);
    }
  }

  function logWater(ml: number) {
    set((s) => ({ ...s, water: [...s.water, { date: today, ml, at: new Date().toISOString() }] }));
  }
  function undoWater() {
    set((s) => {
      const idx = [...s.water].reverse().findIndex((w) => w.date === today);
      if (idx < 0) return s;
      const realIdx = s.water.length - 1 - idx;
      return { ...s, water: s.water.filter((_, i) => i !== realIdx) };
    });
  }

  async function generateReport() {
    if (!profile) return;
    setReportLoad(true);
    setError(null);
    try {
      const last7 = lastNDays(7);
      const days = last7.map((d) => {
        const items = state.foodLog.filter((f) => f.date === d);
        const w = state.water.filter((x) => x.date === d).reduce((s, x) => s + x.ml, 0);
        return {
          date: d,
          calories: items.reduce((s, i) => s + i.calories, 0),
          protein: items.reduce((s, i) => s + i.protein, 0),
          carbs: items.reduce((s, i) => s + i.carbs, 0),
          fats: items.reduce((s, i) => s + i.fats, 0),
          waterMl: w,
        };
      });
      const r = await report({
        data: { goal: profile.goal, targetCalories: calories, targetProtein: macros.protein, days },
      });
      setWeekly(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setReportLoad(false);
    }
  }

  const supps = supplementsFor(profile?.goal);
  const waterPct = Math.min(1, waterToday / Math.max(state.waterTargetMl, 1));

  // BMI + per-meal breakdown
  const bmi =
    profile && profile.heightCm > 0 ? profile.weightKg / Math.pow(profile.heightCm / 100, 2) : 0;
  const bmiBand = bmi < 18.5 ? "UNDER" : bmi < 25 ? "HEALTHY" : bmi < 30 ? "OVER" : "OBESE";
  const goalCue =
    profile?.goal === "CUT"
      ? "Calorie deficit — lean out"
      : profile?.goal === "BULK"
        ? "Calorie surplus — build mass"
        : profile?.goal === "ATHLETIC"
          ? "Slight surplus — fuel performance"
          : "Maintenance — hold weight";
  const perMeal = {
    cal: Math.round(calories / 4),
    p: Math.round(macros.protein / 4),
    c: Math.round(macros.carbs / 4),
    f: Math.round(macros.fats / 4),
  };

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="animate-fade-in">
      <header className="px-5 pt-6 pb-2 animate-slide-down">
        <p className="label-cap">Daily Target</p>
        <div className="display text-6xl font-extrabold text-grit leading-none mt-1">
          {calories}
          <span className="text-2xl text-[#8a8a8a] ml-2">KCAL</span>
        </div>
        <p className="text-xs text-[#8a8a8a] mt-1">
          {totals.c} eaten · {Math.max(0, calories - totals.c)} remaining
        </p>
      </header>

      {/* ===== QUICK ACTIONS — log a meal fast ===== */}
      <div className="px-5 mt-3 animate-slide-up delay-100">
        <p className="label-cap text-[10px] text-[#8a8a8a] mb-2">Log a meal</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
            className="btn-grit py-3 flex flex-col items-center justify-center gap-1 text-[10px]"
          >
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <span className="label-cap">{analyzing ? "…" : "Scan Photo"}</span>
          </button>
          <button
            onClick={() => setBarcodeOpen((v) => !v)}
            className="btn-ghost py-3 flex flex-col items-center justify-center gap-1 text-[10px]"
          >
            <ScanBarcode size={16} />
            <span className="label-cap">Barcode</span>
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("food-log-section");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="btn-ghost py-3 flex flex-col items-center justify-center gap-1 text-[10px]"
          >
            <Plus size={16} />
            <span className="label-cap">Manual</span>
          </button>
        </div>
        {error && <p className="text-xs text-accent-red mt-2">{error}</p>}
      </div>

      {/* BMI + per-meal breakdown */}
      {profile && (
        <div className="px-5 mt-3">
          <div className="bg-grit-card border border-grit p-4">
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
                <p className="display font-extrabold text-grit text-base leading-none">
                  {perMeal.cal}
                </p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">KCAL</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#E10600" }}>
                  {perMeal.p}g
                </p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">PROTEIN</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#fbbf24" }}>
                  {perMeal.c}g
                </p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">CARBS</p>
              </div>
              <div className="border border-grit p-2">
                <p className="display font-extrabold leading-none" style={{ color: "#22c55e" }}>
                  {perMeal.f}g
                </p>
                <p className="label-cap text-[9px] text-[#8a8a8a] mt-1">FATS</p>
              </div>
            </div>
            <p className="text-[10px] text-[#8a8a8a] mt-2 leading-snug">
              Aim for ~
              <span className="text-grit">
                {Math.round(
                  profile.weightKg *
                    (profile.goal === "CUT" ? 2.4 : profile.goal === "ATHLETIC" ? 2.2 : 2.0),
                )}
                g protein/day
              </span>{" "}
              ({(profile.goal === "CUT" ? 2.4 : profile.goal === "ATHLETIC" ? 2.2 : 2.0).toFixed(1)}
              g per kg bodyweight) and{" "}
              <span className="text-grit">{state.waterTargetMl}ml water</span>.
            </p>
          </div>
        </div>
      )}

      {/* Macro ring */}
      <div className="px-5 mt-4 mb-4">
        <MacroRing
          protein={macros.protein}
          carbs={macros.carbs}
          fats={macros.fats}
          pEaten={totals.p}
          cEaten={totals.ca}
          fEaten={totals.fa}
        />
      </div>

      {/* Hydration */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap flex items-center gap-2">
            <Droplets size={12} /> Hydration
          </p>
          <button
            onClick={() =>
              set((s) => ({ ...s, hydrationAlertsEnabled: !s.hydrationAlertsEnabled }))
            }
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
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#3b9eff"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - waterPct)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center display font-extrabold text-grit text-sm">
              {Math.round(waterPct * 100)}%
            </div>
          </div>
          <div className="flex-1">
            <p className="display font-extrabold text-grit text-xl leading-none">
              {waterToday}
              <span className="text-sm text-[#8a8a8a] ml-1">/ {state.waterTargetMl} ML</span>
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={() => logWater(250)} className="btn-ghost text-xs px-3 py-1.5">
                +250
              </button>
              <button onClick={() => logWater(500)} className="btn-ghost text-xs px-3 py-1.5">
                +500
              </button>
              <button onClick={() => logWater(750)} className="btn-ghost text-xs px-3 py-1.5">
                +750
              </button>
              <button onClick={undoWater} className="btn-ghost text-xs px-3 py-1.5 text-[#8a8a8a]">
                Undo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Meals */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap">Today's Meals</p>
          <button onClick={loadMeals} disabled={loading} className="label-cap text-accent-red">
            {loading ? <Loader2 size={12} className="inline animate-spin" /> : "Generate"}
          </button>
        </div>
        <div className="mb-3">
          <input
            value={mealConstraints}
            onChange={(e) => setMealConstraints(e.target.value)}
            placeholder="e.g. no dairy, high protein, quick meals"
            className="input-grit w-full text-xs"
          />
          <p className="text-[9px] uppercase tracking-widest text-[#8a8a8a] mt-1">
            Any preferences or restrictions?
          </p>
        </div>
        {!state.mealPlan && !loading && (
          <div className="bg-grit-card border border-grit p-5 text-sm text-[#8a8a8a]">
            Tap Generate to get AI meal suggestions tuned to your goal.
          </div>
        )}
        {error && <p className="text-sm text-accent-red mb-2">{error}</p>}
        {state.mealPlan &&
          (["breakfast", "lunch", "dinner", "snack"] as const).map((k) => {
            const m = state.mealPlan![k];
            return (
              <div key={k} className="bg-grit-card border border-grit mb-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="label-cap text-accent-red">{k}</p>
                    <p className="display font-extrabold uppercase text-grit text-lg leading-tight">
                      {m.name}
                    </p>
                    <p className="text-xs text-[#8a8a8a] mt-1">
                      {m.calories} kcal · P{m.protein} C{m.carbs} F{m.fats}
                    </p>
                  </div>
                  <button
                    onClick={() => doSwap(k, m)}
                    disabled={!!swapping}
                    className="btn-ghost px-3 py-2"
                  >
                    {swapping === k ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
      </section>

      {/* Food log */}
      <section id="food-log-section" className="px-5 mb-6">
        <p className="label-cap mb-2">Food Log</p>
        <div className="bg-grit-card border border-grit p-4">
          {/* Quick input row */}
          <div className="flex gap-2 mb-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Food"
              className="input-grit flex-1"
            />
            <input
              inputMode="numeric"
              value={cals}
              onChange={(e) => setCals(e.target.value)}
              placeholder="kcal"
              className="input-grit w-20"
            />
            <button onClick={addFood} className="btn-grit px-3">
              <Plus size={16} />
            </button>
          </div>

          {/* Photo + Barcode actions */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-xs"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {analyzing ? "Analyzing…" : "Photo log"}
            </button>
            <button
              onClick={() => setBarcodeOpen((v) => !v)}
              className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-xs"
            >
              <ScanBarcode size={14} /> Barcode
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoSelected}
          />

          {barcodeOpen && (
            <div className="flex gap-2 mb-3">
              <input
                value={barcodeVal}
                onChange={(e) => setBarcodeVal(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter barcode digits"
                inputMode="numeric"
                className="input-grit flex-1"
              />
              <button
                onClick={doBarcode}
                disabled={barcodeLoad || !barcodeVal}
                className="btn-grit px-3"
              >
                {barcodeLoad ? <Loader2 size={14} className="animate-spin" /> : "Find"}
              </button>
            </div>
          )}

          {eaten.length === 0 && (
            <p className="text-xs text-[#8a8a8a]">Nothing logged yet today.</p>
          )}
          {eaten.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-2 border-t border-grit first:border-t-0"
            >
              {f.photoThumb ? (
                <img src={f.photoThumb} alt="" className="w-9 h-9 object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 bg-[#1a1a1a] border border-grit flex items-center justify-center flex-shrink-0">
                  {f.source === "barcode" ? (
                    <ScanBarcode size={12} className="text-[#8a8a8a]" />
                  ) : f.source === "photo" ? (
                    <Camera size={12} className="text-[#8a8a8a]" />
                  ) : (
                    <span className="label-cap text-[8px] text-[#8a8a8a]">M</span>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-grit truncate">{f.name}</p>
                <p className="text-[10px] text-[#8a8a8a]">
                  P{f.protein} · C{f.carbs} · F{f.fats}
                </p>
              </div>
              <span className="text-sm text-[#8a8a8a] font-bold">{f.calories}</span>
              <button onClick={() => removeFood(i)} className="text-[#8a8a8a] p-1">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Report */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap flex items-center gap-2">
            <FileBarChart size={12} /> Weekly Report
          </p>
          <button
            onClick={generateReport}
            disabled={reportLoad}
            className="label-cap text-accent-red"
          >
            {reportLoad ? <Loader2 size={12} className="inline animate-spin" /> : "Run"}
          </button>
        </div>
        {!weekly && (
          <div className="bg-grit-card border border-grit p-4 text-xs text-[#8a8a8a]">
            Generate a 7-day nutrition + hydration grade with wins, misses and one focused action.
          </div>
        )}
        {weekly && (
          <div className="bg-grit-card border border-grit p-5">
            <div className="flex items-end gap-4 mb-4">
              <div className="display font-extrabold text-grit text-6xl leading-none">
                {weekly.grade}
              </div>
              <div className="flex-1">
                <p className="label-cap text-accent-red">Adherence</p>
                <div className="h-2 bg-[#262626] mt-1">
                  <div className="h-full bg-accent-red" style={{ width: `${weekly.adherence}%` }} />
                </div>
                <p className="text-[10px] text-[#8a8a8a] mt-1">{weekly.adherence}% on target</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <Stat label="Avg kcal" value={String(weekly.avgCalories)} />
              <Stat label="Avg P" value={`${weekly.avgProtein}g`} />
              <Stat label="Hydration" value={`${weekly.hydrationScore}%`} />
            </div>
            <div className="mb-3">
              <p className="label-cap text-accent-red mb-1">Wins</p>
              {weekly.wins.map((w, i) => (
                <p key={i} className="text-xs text-grit">
                  + {w}
                </p>
              ))}
            </div>
            <div className="mb-3">
              <p className="label-cap text-[#8a8a8a] mb-1">Misses</p>
              {weekly.misses.map((w, i) => (
                <p key={i} className="text-xs text-[#8a8a8a]">
                  — {w}
                </p>
              ))}
            </div>
            <div className="pt-3 border-t border-grit">
              <p className="label-cap mb-1">Action</p>
              <p className="text-sm text-grit font-bold">{weekly.action}</p>
            </div>
          </div>
        )}
      </section>

      {/* Supplements */}
      <section className="px-5 mb-8">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-grit p-2">
      <p className="label-cap text-[8px]">{label}</p>
      <p className="display font-extrabold text-grit text-lg leading-none mt-1">{value}</p>
    </div>
  );
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function downscale(file: File, maxDim: number): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej();
    img.src = url;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale),
    h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function supplementsFor(goal?: string) {
  const base = [
    { name: "Whey Protein", note: "1 scoop post-workout to hit protein target." },
    { name: "Creatine Monohydrate", note: "5g daily, any time." },
    { name: "Vitamin D3", note: "2000 IU daily with food." },
  ];
  if (goal === "BULK")
    base.push({ name: "Mass Gainer (optional)", note: "If struggling to hit calories." });
  if (goal === "CUT")
    base.push({ name: "Caffeine", note: "200mg pre-workout for output during deficit." });
  if (goal === "ATHLETIC")
    base.push({ name: "Beta-Alanine", note: "3-5g daily for anaerobic capacity." });
  return base;
}

function MacroRing({
  protein,
  carbs,
  fats,
  pEaten,
  cEaten,
  fEaten,
}: {
  protein: number;
  carbs: number;
  fats: number;
  pEaten: number;
  cEaten: number;
  fEaten: number;
}) {
  const size = 200,
    cx = size / 2,
    cy = size / 2;
  const items = [
    { color: "#E10600", target: protein, eaten: pEaten, label: "P", radius: 80 },
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
              <circle
                cx={cx}
                cy={cy}
                r={it.radius}
                fill="none"
                stroke={it.color}
                strokeWidth="8"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct)}
                strokeLinecap="butt"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex-1 space-y-2 text-sm">
        <Row color="#E10600" label="Protein" eaten={pEaten} target={protein} />
        <Row color="#f5f5f0" label="Carbs" eaten={cEaten} target={carbs} />
        <Row color="#8a8a8a" label="Fats" eaten={fEaten} target={fats} />
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  eaten,
  target,
}: {
  color: string;
  label: string;
  eaten: number;
  target: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2" style={{ background: color }} />
        <span className="label-cap" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="font-bold text-grit">
        {eaten}
        <span className="text-[#8a8a8a] font-normal"> / {target}g</span>
      </div>
    </div>
  );
}
