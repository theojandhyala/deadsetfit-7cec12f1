import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Trophy } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { EXERCISES } from "@/lib/exercises";
import { isoDay } from "@/lib/calc";

export const Route = createFileRoute("/_tabs/progress")({
  head: () => ({ meta: [{ title: "GRIT — Progress" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const [state, set] = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [arms, setArms] = useState("");
  const [legs, setLegs] = useState("");

  function addPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      set((s) => ({ ...s, checkIns: [...s.checkIns, { date: new Date().toISOString(), photoDataUrl: url }] }));
    };
    r.readAsDataURL(file);
  }

  function togglePhoto(id: string) {
    setCompare((c) => c.includes(id) ? c.filter(x => x !== id) : c.length < 2 ? [...c, id] : [c[1], id]);
  }

  function logWeight() {
    const w = Number(weight); if (!w) return;
    set((s) => ({ ...s, weights: [...s.weights, { date: isoDay(), weight: w }] }));
    setWeight("");
  }

  function logMeasurements() {
    set((s) => ({ ...s, measurements: [...s.measurements, {
      date: isoDay(), chest: +chest||0, waist: +waist||0, arms: +arms||0, legs: +legs||0
    }]}));
    setChest(""); setWaist(""); setArms(""); setLegs("");
  }

  const prs = EXERCISES.map((ex) => {
    const logs = state.logs.filter((l) => l.exerciseId === ex.id);
    if (logs.length === 0) return null;
    const best = Math.max(...logs.map((l) => l.weight));
    return { name: ex.name, weight: best };
  }).filter(Boolean) as { name: string; weight: number }[];

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4">
        <p className="label-cap">Progress</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit">Track The Work</h1>
      </header>

      {/* Check-in */}
      <section className="px-5 mb-6">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="btn-grit w-full">
          <Camera size={16} className="mr-2" /> Weekly Photo Check-in
        </button>

        {compare.length === 2 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {compare.map((d) => {
              const p = state.checkIns.find((c) => c.date === d);
              return <div key={d} className="border border-accent-red">
                <img src={p?.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="text-[10px] p-1 label-cap text-center">{p?.date.slice(0,10)}</div>
              </div>;
            })}
          </div>
        )}

        {state.checkIns.length > 0 && (
          <>
            <p className="label-cap mt-5 mb-2">Tap two to compare</p>
            <div className="grid grid-cols-3 gap-1">
              {state.checkIns.slice().reverse().map((c) => {
                const sel = compare.includes(c.date);
                return (
                  <button key={c.date} onClick={() => togglePhoto(c.date)} className="relative border" style={{ borderColor: sel ? "#e63222" : "#262626" }}>
                    <img src={c.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                    <span className="absolute bottom-0 inset-x-0 text-[9px] text-center label-cap py-0.5" style={{ background: "rgba(0,0,0,0.7)" }}>{c.date.slice(5,10)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Weight */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Weight Log</p>
        <div className="bg-grit-card border border-grit p-4">
          <div className="flex gap-2 mb-3">
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Today's kg" className="input-grit" />
            <button onClick={logWeight} className="btn-grit">Log</button>
          </div>
          <WeightChart entries={state.weights} />
        </div>
      </section>

      {/* Measurements */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Measurements (cm)</p>
        <div className="bg-grit-card border border-grit p-4 grid grid-cols-2 gap-3">
          <Input label="Chest" v={chest} set={setChest} />
          <Input label="Waist" v={waist} set={setWaist} />
          <Input label="Arms" v={arms} set={setArms} />
          <Input label="Legs" v={legs} set={setLegs} />
          <button onClick={logMeasurements} className="btn-grit col-span-2">Save</button>
          {state.measurements.length > 0 && (
            <div className="col-span-2 mt-2 text-xs text-[#8a8a8a]">
              Last: {state.measurements[state.measurements.length-1].date} — C{state.measurements[state.measurements.length-1].chest} W{state.measurements[state.measurements.length-1].waist} A{state.measurements[state.measurements.length-1].arms} L{state.measurements[state.measurements.length-1].legs}
            </div>
          )}
        </div>
      </section>

      {/* PRs */}
      <section className="px-5 mb-8">
        <p className="label-cap mb-2 flex items-center gap-2"><Trophy size={12} /> Personal Records</p>
        <div className="bg-grit-card border border-grit">
          {prs.length === 0 && <p className="p-5 text-sm text-[#8a8a8a]">Log a set to start tracking PRs.</p>}
          {prs.sort((a,b) => b.weight - a.weight).map((p) => (
            <div key={p.name} className="flex items-center justify-between px-4 py-3 border-b border-grit last:border-b-0">
              <span className="font-bold uppercase text-sm text-grit tracking-wide">{p.name}</span>
              <span className="display font-extrabold text-accent-red">{p.weight} KG</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Input({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <div>
      <label className="label-cap block mb-1">{label}</label>
      <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} className="input-grit" />
    </div>
  );
}

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
  if (entries.length < 2) {
    return <p className="text-xs text-[#8a8a8a]">Log at least two entries to see your trend.</p>;
  }
  const w = 300, h = 100, pad = 6;
  const vals = entries.map((e) => e.weight);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = entries.map((e, i) => {
    const x = pad + (i * (w - pad * 2)) / (entries.length - 1);
    const y = h - pad - ((e.weight - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <polyline points={pts} fill="none" stroke="#e63222" strokeWidth="2" />
      {entries.map((e, i) => {
        const x = pad + (i * (w - pad * 2)) / (entries.length - 1);
        const y = h - pad - ((e.weight - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#f5f5f0" />;
      })}
    </svg>
  );
}
