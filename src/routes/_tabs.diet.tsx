import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/lib/storage";
import { calculateCalories, calculateMacros, isoDay } from "@/lib/calc";
import { generateMeals, swapMeal } from "@/lib/ai.functions";
import type { Meal, MealPlan } from "@/lib/types";

export const Route = createFileRoute("/_tabs/diet")({
  head: () => ({ meta: [{ title: "GRIT — Diet" }] }),
  component: DietPage,
});

function DietPage() {
  const [state, set] = useAppState();
  const gen = useServerFn(generateMeals);
  const swap = useServerFn(swapMeal);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [cals, setCals] = useState("");

  const profile = state.profile;
  const calories = useMemo(() => profile ? calculateCalories(profile) : 0, [profile]);
  const macros = useMemo(() => profile ? calculateMacros(profile, calories) : { protein: 0, carbs: 0, fats: 0 }, [profile, calories]);

  const today = isoDay();
  const eaten = state.foodLog.filter((f) => f.date === today);
  const totals = eaten.reduce((a, f) => ({ c: a.c + f.calories, p: a.p + f.protein, ca: a.ca + f.carbs, fa: a.fa + f.fats }), { c:0, p:0, ca:0, fa:0 });

  async function loadMeals() {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      const res = await gen({ data: { goal: profile.goal, calories, ...macros, dislikes: profile.injuries } });
      set((s) => ({ ...s, mealPlan: res }));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function doSwap(key: keyof MealPlan, meal: Meal) {
    setSwapping(key); setError(null);
    try {
      const r = await swap({ data: meal });
      set((s) => s.mealPlan ? ({ ...s, mealPlan: { ...s.mealPlan, [key]: r } }) : s);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSwapping(null); }
  }

  function addFood() {
    const c = Number(cals); if (!name || !c) return;
    set((s) => ({ ...s, foodLog: [...s.foodLog, { date: today, name, calories: c, protein: 0, carbs: 0, fats: 0 }] }));
    setName(""); setCals("");
  }

  const supps = supplementsFor(profile?.goal);

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-2">
        <p className="label-cap">Daily Target</p>
        <div className="display text-6xl font-extrabold text-grit leading-none mt-1">{calories}<span className="text-2xl text-[#8a8a8a] ml-2">KCAL</span></div>
        <p className="text-xs text-[#8a8a8a] mt-1">{totals.c} eaten · {Math.max(0, calories - totals.c)} remaining</p>
      </header>

      {/* Macro ring */}
      <div className="px-5 mt-4 mb-6">
        <MacroRing protein={macros.protein} carbs={macros.carbs} fats={macros.fats}
          pEaten={totals.p} cEaten={totals.ca} fEaten={totals.fa} />
      </div>

      {/* Meals */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap">Today's Meals</p>
          <button onClick={loadMeals} disabled={loading} className="label-cap text-accent-red">
            {loading ? <Loader2 size={12} className="inline animate-spin" /> : "Generate"}
          </button>
        </div>
        {!state.mealPlan && !loading && (
          <div className="bg-grit-card border border-grit p-5 text-sm text-[#8a8a8a]">Tap Generate to get AI meal suggestions for your goal.</div>
        )}
        {error && <p className="text-sm text-accent-red mb-2">{error}</p>}
        {state.mealPlan && (["breakfast","lunch","dinner","snack"] as const).map((k) => {
          const m = state.mealPlan![k];
          return (
            <div key={k} className="bg-grit-card border border-grit mb-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="label-cap text-accent-red">{k}</p>
                  <p className="display font-extrabold uppercase text-grit text-lg leading-tight">{m.name}</p>
                  <p className="text-xs text-[#8a8a8a] mt-1">{m.calories} kcal · P{m.protein} C{m.carbs} F{m.fats}</p>
                </div>
                <button onClick={() => doSwap(k, m)} disabled={!!swapping} className="btn-ghost px-3 py-2">
                  {swapping === k ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Food log */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Food Log</p>
        <div className="bg-grit-card border border-grit p-4">
          <div className="flex gap-2 mb-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food" className="input-grit flex-1" />
            <input inputMode="numeric" value={cals} onChange={(e) => setCals(e.target.value)} placeholder="kcal" className="input-grit w-24" />
            <button onClick={addFood} className="btn-grit px-3"><Plus size={16} /></button>
          </div>
          {eaten.length === 0 && <p className="text-xs text-[#8a8a8a]">Nothing logged yet today.</p>}
          {eaten.map((f, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-t border-grit first:border-t-0">
              <span className="text-grit">{f.name}</span>
              <span className="text-[#8a8a8a]">{f.calories} kcal</span>
            </div>
          ))}
        </div>
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
  const size = 200, r = 70, cx = size/2, cy = size/2;
  const C = 2 * Math.PI * r;
  // Three concentric arcs offset
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
