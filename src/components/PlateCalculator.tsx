import { useMemo, useState } from "react";
import { X } from "lucide-react";

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

function platesPerSide(targetKg: number, barKg: number) {
  if (targetKg <= barKg) return { plates: [] as number[], remainder: 0, perSide: 0 };
  const perSide = (targetKg - barKg) / 2;
  let rem = perSide;
  const plates: number[] = [];
  for (const p of PLATES_KG) {
    while (rem + 1e-6 >= p) {
      plates.push(p);
      rem = +(rem - p).toFixed(3);
    }
  }
  return { plates, remainder: +rem.toFixed(3), perSide };
}

const PLATE_COLOR: Record<number, string> = {
  25: "#e63222",
  20: "#1a1a1a",
  15: "#f5c542",
  10: "#1e63d1",
  5: "#f5f5f0",
  2.5: "#3a8a3a",
  1.25: "#7a7a7a",
};

export function PlateCalculator({
  initialWeight,
  onClose,
  onApply,
}: {
  initialWeight: number;
  onClose: () => void;
  onApply?: (weight: number) => void;
}) {
  const [weight, setWeight] = useState(String(initialWeight || 60));
  const [bar, setBar] = useState(20);
  const w = Number(weight) || 0;

  const { plates, remainder, perSide } = useMemo(() => platesPerSide(w, bar), [w, bar]);

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-grit-card border border-grit p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="label-cap text-accent-red">PLATE CALCULATOR</p>
          <button onClick={onClose} className="text-grit-dim"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="label-cap block mb-1">Target Weight (kg)</label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              className="input-grit w-full text-center display text-2xl font-extrabold"
            />
          </div>
          <div>
            <label className="label-cap block mb-1">Bar</label>
            <select
              value={bar}
              onChange={(e) => setBar(Number(e.target.value))}
              className="input-grit"
            >
              <option value={20}>20kg</option>
              <option value={15}>15kg</option>
              <option value={10}>10kg</option>
              <option value={7}>7kg</option>
              <option value={0}>0</option>
            </select>
          </div>
        </div>

        <div className="mt-5 bg-[#0a0a0a] border border-grit p-4">
          <p className="label-cap text-[10px] text-grit-dim mb-2">PER SIDE · {perSide.toFixed(2)}kg</p>
          {plates.length === 0 ? (
            <p className="text-sm text-grit-dim">{w < bar ? "Below bar weight." : "—"}</p>
          ) : (
            <div className="flex items-center gap-1 flex-wrap">
              {/* sleeve indicator */}
              <div className="w-3 h-2 bg-grit-dim" />
              {plates.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-[10px] font-extrabold border border-black/40"
                  style={{
                    background: PLATE_COLOR[p] ?? "#444",
                    color: p === 5 || p === 15 ? "#0a0a0a" : "#f5f5f0",
                    width: 22 + p * 1.4,
                    height: 36 + p * 2.2,
                  }}
                >
                  {p}
                </div>
              ))}
            </div>
          )}
          {remainder > 0 && (
            <p className="text-[11px] text-accent-red mt-2">
              {remainder.toFixed(2)}kg unloaded — closest match shown.
            </p>
          )}
        </div>

        {onApply && (
          <button
            onClick={() => { onApply(w); onClose(); }}
            className="btn-grit w-full mt-4"
          >
            Use {w}kg
          </button>
        )}
      </div>
    </div>
  );
}
