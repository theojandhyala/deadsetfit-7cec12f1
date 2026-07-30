import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

import { lookupBarcode, searchFoods, type FoodSearchResult } from "@/lib/diet.functions";
import { MEALS, mealFor, recentMeal, suggestedMeal, type MealType } from "@/lib/nutrition";
import type { FoodLogItem } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Panel = "manual" | "barcode" | "search" | null;

export function NutritionLogger({
  today,
  foodLog,
  presets,
  onAdd,
  onRemove,
}: {
  today: string;
  foodLog: FoodLogItem[];
  presets: Array<Omit<FoodLogItem, "date" | "source">>;
  onAdd: (items: Array<Omit<FoodLogItem, "date">>) => void;
  onRemove: (todayIndex: number) => void;
}) {
  const [meal, setMeal] = useState<MealType>(() => suggestedMeal());
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const caloriesRef = useRef<HTMLInputElement>(null);
  const proteinRef = useRef<HTMLInputElement>(null);
  const carbsRef = useRef<HTMLInputElement>(null);
  const fatsRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  const eaten = useMemo(
    () => foodLog.map((item, index) => ({ item, index })).filter(({ item }) => item.date === today),
    [foodLog, today],
  );
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        MEALS.map((type) => [type, eaten.filter(({ item }) => mealFor(item) === type)]),
      ) as Record<MealType, typeof eaten>,
    [eaten],
  );

  function open(next: Exclude<Panel, null>, targetMeal = meal) {
    setMeal(targetMeal);
    setPanel(next);
  }

  function addOne(item: Omit<FoodLogItem, "date" | "meal">) {
    onAdd([{ ...item, meal }]);
    toast.success(`${item.name} added to ${mealLabel(meal)}`);
  }

  function addManual() {
    const name = nameRef.current?.value.trim() ?? "";
    if (!name) {
      nameRef.current?.focus();
      return;
    }
    addOne({
      name,
      calories: numberValue(caloriesRef),
      protein: numberValue(proteinRef),
      carbs: numberValue(carbsRef),
      fats: numberValue(fatsRef),
      source: "manual",
    });
    setPanel(null);
  }

  async function findBarcode() {
    const barcode = (barcodeRef.current?.value ?? "").replace(/\D/g, "");
    if (barcode.length < 6) return toast.error("Enter the full barcode number");
    setBusy(true);
    try {
      const food = await lookupBarcode({ data: { barcode } });
      addOne({ ...food, name: food.name, source: "barcode" });
      setPanel(null);
    } catch (error) {
      toast.error(errorMessage(error, "That barcode could not be found"));
    } finally {
      setBusy(false);
    }
  }

  async function findFoods() {
    const query = queryRef.current?.value.trim() ?? "";
    if (query.length < 2) return;
    setSearching(true);
    try {
      const response = await searchFoods(query);
      setResults(response.foods);
      if (!response.foods.length) {
        toast("No matching foods", { description: "Try a brand name or fewer words." });
      }
    } catch (error) {
      toast.error(errorMessage(error, "Food search is unavailable"));
    } finally {
      setSearching(false);
    }
  }

  function repeat(type: MealType) {
    const previous = recentMeal(foodLog, type, today);
    if (!previous) return;
    onAdd(previous.items.map((item) => ({ ...item, meal: type, source: "quick" })));
    toast.success(`${mealLabel(type)} copied from ${shortDate(previous.date)}`);
  }

  return (
    <section id="food-log-section" className="deadset-section space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-cap text-accent-red">Food diary</p>
          <h2 className="display text-2xl font-black text-grit uppercase mt-1">Log in seconds</h2>
        </div>
        <span className="text-xs text-grit-dim">
          {eaten.length} {eaten.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Action icon={Search} label="Search foods" primary onClick={() => open("search")} />
        <Action icon={ScanBarcode} label="Barcode" onClick={() => open("barcode")} />
        <Action icon={Plus} label="Manual" onClick={() => open("manual")} />
      </div>

      {presets.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {presets.slice(0, 6).map((preset) => (
            <button
              key={preset.name}
              onClick={() => addOne({ ...preset, source: "quick" })}
              className="press shrink-0 rounded-full border border-grit bg-grit-card px-3 py-2 text-left"
            >
              <span className="text-xs font-bold text-grit">{preset.name}</span>
              <span className="ml-2 text-[10px] text-grit-dim">{preset.calories} kcal</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-grit bg-grit-card">
        {MEALS.map((type) => {
          const entries = grouped[type];
          const total = entries.reduce((sum, { item }) => sum + item.calories, 0);
          const previous = recentMeal(foodLog, type, today);
          return (
            <div key={type} className="border-b border-grit last:border-0">
              <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="label-cap text-[11px] text-grit">{mealLabel(type)}</p>
                    <span className="text-[10px] text-grit-dim">{Math.round(total)} kcal</span>
                  </div>
                  {!entries.length && (
                    <p className="text-[11px] text-grit-dim mt-0.5">Nothing logged</p>
                  )}
                </div>
                {previous && !entries.length && (
                  <button
                    onClick={() => repeat(type)}
                    className="press p-2 text-grit-dim"
                    title={`Repeat ${mealLabel(type).toLowerCase()}`}
                    aria-label={`Repeat ${mealLabel(type).toLowerCase()}`}
                  >
                    <Copy size={15} />
                  </button>
                )}
                <button
                  onClick={() => open("search", type)}
                  className="press flex h-8 w-8 items-center justify-center rounded-full bg-accent-red text-white"
                  aria-label={`Add to ${mealLabel(type).toLowerCase()}`}
                >
                  <Plus size={16} />
                </button>
              </div>
              {entries.map(({ item, index }) => (
                <div
                  key={`${index}-${item.name}`}
                  className="flex items-center gap-3 border-t border-grit/70 px-4 py-2.5"
                >
                  <SourceIcon source={item.source} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-grit">{item.name}</p>
                    <p className="text-[10px] text-grit-dim">
                      {item.serving ? `${item.serving} · ` : ""}P {item.protein} · C {item.carbs} ·
                      F {item.fats}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-grit">{Math.round(item.calories)}</span>
                  <button
                    onClick={() => onRemove(eaten.findIndex((entry) => entry.index === index))}
                    className="press p-1.5 text-grit-dim"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <Sheet open={panel !== null} onOpenChange={(isOpen) => !isOpen && setPanel(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-grit bg-[#0b0b0b] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6"
        >
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="display text-2xl font-black uppercase text-grit">
              {panel === "search" ? "Find food" : panel === "barcode" ? "Barcode" : "Quick add"}
            </SheetTitle>
            <SheetDescription className="text-xs text-grit-dim">
              Choose the meal, check the serving, then add it to today.
            </SheetDescription>
          </SheetHeader>

          <MealPicker value={meal} onChange={setMeal} />

          {panel === "manual" && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <input
                ref={nameRef}
                className="input-grit col-span-2"
                placeholder="Food name"
                autoCapitalize="words"
              />
              <MacroInput inputRef={caloriesRef} placeholder="Calories" />
              <MacroInput inputRef={proteinRef} placeholder="Protein g" />
              <MacroInput inputRef={carbsRef} placeholder="Carbs g" />
              <MacroInput inputRef={fatsRef} placeholder="Fat g" />
              <button onClick={addManual} className="btn-grit col-span-2 mt-2 gap-2">
                <Check size={16} /> Add food
              </button>
            </div>
          )}

          {panel === "barcode" && (
            <div className="mt-5">
              <div className="flex gap-2">
                <input
                  ref={barcodeRef}
                  className="input-grit flex-1"
                  placeholder="Barcode number"
                  inputMode="numeric"
                />
                <button
                  onClick={() => void findBarcode()}
                  disabled={busy}
                  className="btn-grit px-4"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : "Find"}
                </button>
              </div>
              <p className="mt-3 text-xs text-grit-dim">
                Enter the digits printed below the product barcode.
              </p>
            </div>
          )}

          {panel === "search" && (
            <div className="mt-5">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void findFoods();
                }}
              >
                <input
                  ref={queryRef}
                  className="input-grit flex-1"
                  placeholder="Food or brand"
                  enterKeyHint="search"
                />
                <button disabled={searching} className="btn-grit px-4" aria-label="Search foods">
                  {searching ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </button>
              </form>
              <div className="mt-3 divide-y divide-grit">
                {results.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => {
                      const { id: _id, ...item } = food;
                      void _id;
                      addOne({ ...item, source: "search" });
                      setPanel(null);
                    }}
                    className="press flex w-full items-center gap-3 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-grit">{food.name}</p>
                      <p className="text-[11px] text-grit-dim">
                        {food.serving} · P {food.protein} · C {food.carbs} · F {food.fats}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-grit">{food.calories} kcal</span>
                    <ChevronRight size={15} className="text-grit-dim" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Action({
  icon: Icon,
  label,
  primary,
  onClick,
}: {
  icon: typeof Search;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`press flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-center ${
        primary
          ? "border-accent-red bg-accent-red text-white"
          : "border-grit bg-grit-card text-grit"
      }`}
    >
      <Icon size={18} />
      <span className="label-cap text-[8px] leading-tight">{label}</span>
    </button>
  );
}

function MealPicker({ value, onChange }: { value: MealType; onChange: (meal: MealType) => void }) {
  return (
    <div className="no-scrollbar mt-4 flex overflow-x-auto rounded-xl border border-grit bg-[#070707] p-1">
      {MEALS.map((meal) => (
        <button
          key={meal}
          onClick={() => onChange(meal)}
          className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-[9px] font-bold ${
            value === meal ? "bg-[#f5f5f0] text-black" : "text-grit-dim"
          }`}
        >
          {mealLabel(meal)}
        </button>
      ))}
    </div>
  );
}

function SourceIcon({ source }: { source: FoodLogItem["source"] }) {
  const Icon = source === "barcode" ? ScanBarcode : source === "search" ? Search : Utensils;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grit bg-[#111] text-grit-dim">
      <Icon size={13} />
    </div>
  );
}

function MacroInput({
  inputRef,
  placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
}) {
  return (
    <input ref={inputRef} className="input-grit" placeholder={placeholder} inputMode="decimal" />
  );
}

function numberValue(ref: React.RefObject<HTMLInputElement | null>) {
  return Math.max(0, Number(ref.current?.value) || 0);
}

function mealLabel(meal: MealType) {
  return meal === "SNACK" ? "Snacks" : meal[0] + meal.slice(1).toLowerCase();
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
