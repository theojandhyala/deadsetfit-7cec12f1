import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { estimate1RM } from "@/lib/calc";
import { useUnit } from "@/hooks/useUnit";

const PERCENTAGES = [95, 90, 85, 80, 75, 70, 65, 60] as const;

/** Round to the nearest 2.5 kg (smallest common plate pair increment). */
function roundTo2p5(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

export function OneRmCalculator({
  initialWeight,
  initialReps,
}: {
  initialWeight?: number;
  initialReps?: number;
}) {
  const unit = useUnit();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(
    initialWeight && initialWeight > 0 ? String(initialWeight) : "",
  );
  const [reps, setReps] = useState(
    initialReps && initialReps >= 1 ? String(Math.min(12, Math.round(initialReps))) : "",
  );

  const w = Number(weight);
  const r = Number(reps);
  const valid =
    weight.trim() !== "" &&
    reps.trim() !== "" &&
    Number.isFinite(w) &&
    w > 0 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 12;
  const oneRm = valid ? estimate1RM(w, r) : 0;

  return (
    <section className="mx-5 mb-4 bg-grit-card border border-grit rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between"
      >
        <span className="font-display uppercase text-sm font-extrabold tracking-widest text-grit">
          1RM Calculator
        </span>
        <ChevronDown
          size={18}
          className={`text-grit-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-cap block mb-1" htmlFor="onerm-weight">
                Weight (kg)
              </label>
              <input
                id="onerm-weight"
                defaultValue={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
                className="input-grit w-full text-center font-display text-xl font-extrabold"
              />
            </div>
            <div>
              <label className="label-cap block mb-1" htmlFor="onerm-reps">
                Reps (1–12)
              </label>
              <input
                id="onerm-reps"
                defaultValue={reps}
                onChange={(e) => setReps(e.target.value)}
                inputMode="numeric"
                className="input-grit w-full text-center font-display text-xl font-extrabold"
              />
            </div>
          </div>

          {valid ? (
            <div className="mt-4">
              <p className="label-cap text-[10px] text-grit-dim">Estimated 1RM</p>
              <p className="font-display uppercase text-4xl font-extrabold text-accent-red leading-none mt-1">
                {oneRm}
                <span className="text-xs text-grit-dim ml-1">{unit}</span>
              </p>

              <div className="mt-4 border-t border-grit pt-3 grid grid-cols-4 gap-2">
                {PERCENTAGES.map((pct) => (
                  <div key={pct} className="text-center">
                    <p className="label-cap text-[10px] text-grit-dim">{pct}%</p>
                    <p className="font-display text-base font-extrabold text-grit leading-tight">
                      {formatKg(roundTo2p5((oneRm * pct) / 100))}
                      <span className="text-[9px] text-grit-dim ml-0.5">{unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-grit-dim mt-3">
              Enter a weight and reps (1–12) to estimate your one-rep max.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
