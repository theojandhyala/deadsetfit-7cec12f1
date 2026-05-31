import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Camera, Trophy, Loader2, Sparkles, Flame, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { isoDay, calculateStreak } from "@/lib/calc";
import { analyzePhysique } from "@/lib/physique.functions";
import type { PhysiqueScan } from "@/lib/types";

export const Route = createFileRoute("/_tabs/progress")({
  head: () => ({ meta: [{ title: "GRIT — Progress" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const [state, set] = useAppState();
  const photoRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [arms, setArms] = useState("");
  const [legs, setLegs] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [viewScan, setViewScan] = useState<PhysiqueScan | null>(null);
  const analyze = useServerFn(analyzePhysique);

  const streak = calculateStreak(state.completedDates);
  const totalSessions = state.sessions.filter((s) => s.endedAt).length;
  const totalVolume = state.sessions.reduce((a, s) => a + (s.totalVolume || 0), 0);
  const totalPRs = state.sessions.reduce((a, s) => a + (s.prCount || 0), 0);

  function addPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      set((s) => ({ ...s, checkIns: [...s.checkIns, { date: new Date().toISOString(), photoDataUrl: url }] }));
    };
    r.readAsDataURL(file);
  }

  async function runScan(file: File) {
    setScanError(null);
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    // downscale to keep payload small
    const small = await downscale(dataUrl, 768);
    setScanning(true);
    try {
      const analysis = await analyze({ data: {
        imageDataUrl: small,
        goal: state.profile?.goal || "MAINTAIN",
        weightKg: state.profile?.weightKg,
      }});
      const scan: PhysiqueScan = { id: crypto.randomUUID(), date: new Date().toISOString(), photoDataUrl: small, analysis };
      set((s) => ({ ...s, physiqueScans: [...s.physiqueScans, scan] }));
      setViewScan(scan);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally { setScanning(false); }
  }

  function togglePhoto(id: string) {
    setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length < 2 ? [...c, id] : [c[1], id]);
  }
  function logWeight() {
    const w = Number(weight); if (!w) return;
    set((s) => ({ ...s, weights: [...s.weights, { date: isoDay(), weight: w }] }));
    setWeight("");
  }
  function logMeasurements() {
    set((s) => ({ ...s, measurements: [...s.measurements, {
      date: isoDay(), chest: +chest || 0, waist: +waist || 0, arms: +arms || 0, legs: +legs || 0,
    }]}));
    setChest(""); setWaist(""); setArms(""); setLegs("");
  }

  // PRs across both new sessions and legacy logs
  const prs = useMemo(() => {
    const byId = new Map<string, { name: string; weight: number }>();
    state.logs.forEach((l) => {
      const ex = getExercise(l.exerciseId);
      const name = ex?.name ?? l.exerciseId;
      const cur = byId.get(l.exerciseId);
      if (!cur || l.weight > cur.weight) byId.set(l.exerciseId, { name, weight: l.weight });
    });
    state.sessions.forEach((s) => s.exercises.forEach((e) => e.sets.forEach((set) => {
      const cur = byId.get(e.exerciseId);
      if (!cur || set.weight > cur.weight) byId.set(e.exerciseId, { name: e.name, weight: set.weight });
    })));
    return Array.from(byId.values()).filter((p) => p.weight > 0).sort((a, b) => b.weight - a.weight);
  }, [state.logs, state.sessions]);

  // Body part volume split (last 30 days from sessions)
  const bodyParts = useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    state.sessions.forEach((s) => {
      if (new Date(s.startedAt).getTime() < cutoff) return;
      s.exercises.forEach((e) => {
        const vol = e.sets.reduce((a, x) => a + x.weight * x.reps, 0);
        const parts = e.primary_muscles.length ? e.primary_muscles : ["OTHER"];
        parts.forEach((p) => { map[p.toUpperCase()] = (map[p.toUpperCase()] || 0) + vol / parts.length; });
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [state.sessions]);

  // Strength curves: top 3 exercises by frequency
  const strengthCurves = useMemo(() => {
    const map = new Map<string, { name: string; points: { date: string; weight: number }[] }>();
    [...state.logs].sort((a, b) => a.date.localeCompare(b.date)).forEach((l) => {
      const ex = getExercise(l.exerciseId);
      const name = ex?.name ?? l.exerciseId;
      if (!map.has(l.exerciseId)) map.set(l.exerciseId, { name, points: [] });
      const e = map.get(l.exerciseId)!;
      const day = l.date.slice(0, 10);
      const existing = e.points.find((p) => p.date === day);
      if (existing) existing.weight = Math.max(existing.weight, l.weight);
      else e.points.push({ date: day, weight: l.weight });
    });
    state.sessions.forEach((s) => s.exercises.forEach((e) => e.sets.forEach((set) => {
      const key = e.exerciseId;
      if (!map.has(key)) map.set(key, { name: e.name, points: [] });
      const entry = map.get(key)!;
      const day = s.date;
      const existing = entry.points.find((p) => p.date === day);
      if (existing) existing.weight = Math.max(existing.weight, set.weight);
      else entry.points.push({ date: day, weight: set.weight });
    })));
    return Array.from(map.values())
      .filter((e) => e.points.length >= 2)
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 3);
  }, [state.logs, state.sessions]);

  const latestScan = state.physiqueScans[state.physiqueScans.length - 1];

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4">
        <p className="label-cap">Progress</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit">Track The Work</h1>
      </header>

      {/* Hero stats */}
      <section className="px-5 mb-6 grid grid-cols-2 gap-3">
        <Stat label="STREAK" value={`${streak}`} sub="DAYS" accent={streak > 0} icon={<Flame size={14} />} />
        <Stat label="SESSIONS" value={`${totalSessions}`} sub="LOGGED" />
        <Stat label="VOLUME" value={`${Math.round(totalVolume).toLocaleString()}`} sub="KG" />
        <Stat label="PRS" value={`${totalPRs}`} sub="HIT" accent={totalPRs > 0} />
      </section>

      {/* Calendar streak */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Last 12 Weeks</p>
        <div className="bg-grit-card border border-grit p-4 overflow-x-auto">
          <StreakCalendar completedDates={state.completedDates} />
        </div>
      </section>

      {/* Physique Scan */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-2"><Sparkles size={12} /> AI Physique Scan</p>
        <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) runScan(f); e.target.value = ""; }} />
        {latestScan ? (
          <button onClick={() => setViewScan(latestScan)} className="bg-grit-card border border-grit p-4 w-full text-left flex gap-4">
            <img src={latestScan.photoDataUrl} alt="" className="w-20 h-28 object-cover border border-grit" />
            <div className="flex-1 min-w-0">
              <p className="label-cap text-[10px] text-grit-dim">LATEST {latestScan.date.slice(0, 10)}</p>
              <div className="flex gap-3 mt-1">
                <ScoreChip label="BF" value={`${latestScan.analysis.bodyFatEstimate}%`} />
                <ScoreChip label="MUS" value={`${latestScan.analysis.muscleScore}`} />
                <ScoreChip label="SYM" value={`${latestScan.analysis.symmetryScore}`} />
              </div>
              <p className="text-xs uppercase font-bold text-grit mt-2 line-clamp-2">{latestScan.analysis.verdict}</p>
            </div>
          </button>
        ) : null}
        <button onClick={() => scanRef.current?.click()} disabled={scanning} className="btn-grit w-full mt-3">
          {scanning ? <Loader2 className="animate-spin mr-2" size={16} /> : <Camera size={16} className="mr-2" />}
          {scanning ? "Analyzing..." : latestScan ? "New Scan" : "Take Physique Scan"}
        </button>
        {scanError && <p className="text-sm text-accent-red mt-2">{scanError}</p>}
        {state.physiqueScans.length > 1 && (
          <div className="grid grid-cols-4 gap-1 mt-3">
            {state.physiqueScans.slice().reverse().slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => setViewScan(p)} className="border border-grit">
                <img src={p.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Strength Curves */}
      {strengthCurves.length > 0 && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2">Strength Curves</p>
          <div className="flex flex-col gap-3">
            {strengthCurves.map((c) => (
              <div key={c.name} className="bg-grit-card border border-grit p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="display text-sm uppercase font-extrabold text-grit truncate">{c.name}</p>
                  <p className="display text-lg font-extrabold text-accent-red">{Math.max(...c.points.map((p) => p.weight))}KG</p>
                </div>
                <LineChart points={c.points.map((p) => p.weight)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Body Part Split */}
      {bodyParts.length > 0 && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2">Body Part Volume (30d)</p>
          <div className="bg-grit-card border border-grit p-4 flex flex-col gap-2">
            {(() => {
              const max = Math.max(...bodyParts.map((b) => b[1]));
              return bodyParts.map(([name, vol]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs uppercase font-bold tracking-wider mb-1">
                    <span className="text-grit">{name}</span>
                    <span className="text-grit-dim">{Math.round(vol).toLocaleString()}kg</span>
                  </div>
                  <div className="h-2 bg-[#0a0a0a]">
                    <div className="h-full bg-accent-red" style={{ width: `${(vol / max) * 100}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </section>
      )}

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
              Last: {state.measurements[state.measurements.length - 1].date} — C{state.measurements[state.measurements.length - 1].chest} W{state.measurements[state.measurements.length - 1].waist} A{state.measurements[state.measurements.length - 1].arms} L{state.measurements[state.measurements.length - 1].legs}
            </div>
          )}
        </div>
      </section>

      {/* Check-ins */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Photo Check-ins</p>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value = ""; }} />
        <button onClick={() => photoRef.current?.click()} className="btn-ghost w-full">
          <Camera size={16} className="mr-2" /> Weekly Check-in
        </button>
        {compare.length === 2 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {compare.map((d) => {
              const p = state.checkIns.find((c) => c.date === d);
              return <div key={d} className="border border-accent-red">
                <img src={p?.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                <div className="text-[10px] p-1 label-cap text-center">{p?.date.slice(0, 10)}</div>
              </div>;
            })}
          </div>
        )}
        {state.checkIns.length > 0 && (
          <>
            <p className="label-cap mt-3 mb-2 text-[10px]">Tap two to compare</p>
            <div className="grid grid-cols-3 gap-1">
              {state.checkIns.slice().reverse().map((c) => {
                const sel = compare.includes(c.date);
                return (
                  <button key={c.date} onClick={() => togglePhoto(c.date)} className="relative border" style={{ borderColor: sel ? "#e63222" : "#262626" }}>
                    <img src={c.photoDataUrl} alt="" className="w-full aspect-[3/4] object-cover" />
                    <span className="absolute bottom-0 inset-x-0 text-[9px] text-center label-cap py-0.5" style={{ background: "rgba(0,0,0,0.7)" }}>{c.date.slice(5, 10)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* PRs */}
      <section className="px-5 mb-8">
        <p className="label-cap mb-2 flex items-center gap-2"><Trophy size={12} /> Personal Records</p>
        <div className="bg-grit-card border border-grit">
          {prs.length === 0 && <p className="p-5 text-sm text-[#8a8a8a]">Log a set to start tracking PRs.</p>}
          {prs.slice(0, 20).map((p) => (
            <div key={p.name} className="flex items-center justify-between px-4 py-3 border-b border-grit last:border-b-0">
              <span className="font-bold uppercase text-sm text-grit tracking-wide truncate pr-2">{p.name}</span>
              <span className="display font-extrabold text-accent-red flex-shrink-0">{p.weight} KG</span>
            </div>
          ))}
        </div>
      </section>

      {viewScan && <ScanModal scan={viewScan} onClose={() => setViewScan(null)} />}
    </div>
  );
}

function Stat({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="bg-grit-card border border-grit p-3">
      <p className="label-cap text-[10px] text-grit-dim flex items-center gap-1">{icon}{label}</p>
      <p className="display text-3xl font-extrabold leading-none mt-1" style={{ color: accent ? "#e63222" : "#f5f5f0" }}>{value}</p>
      {sub && <p className="text-[10px] text-grit-dim uppercase tracking-wider mt-1">{sub}</p>}
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-grit px-2 py-1">
      <p className="text-[8px] uppercase tracking-wider text-grit-dim">{label}</p>
      <p className="display text-sm font-extrabold text-grit leading-none">{value}</p>
    </div>
  );
}

function StreakCalendar({ completedDates }: { completedDates: string[] }) {
  const set = new Set(completedDates);
  const weeks = 12;
  const cells: { date: string; done: boolean; isToday: boolean }[][] = [];
  const today = new Date();
  // align to Monday of current week
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; done: boolean; isToday: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const iso = dt.toISOString().slice(0, 10);
      col.push({ date: iso, done: set.has(iso), isToday: iso === isoDay() });
    }
    cells.push(col);
  }
  return (
    <div className="flex gap-[3px]">
      {cells.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((c) => (
            <div key={c.date} title={c.date}
              className="w-3 h-3"
              style={{
                background: c.done ? "#e63222" : "#1a1a1a",
                outline: c.isToday ? "1px solid #f5f5f0" : undefined,
              }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-xs text-[#8a8a8a]">Not enough data.</p>;
  const w = 320, h = 80, pad = 6;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const pts = points.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (points.length - 1);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#e63222" strokeWidth="2" />
    </svg>
  );
}

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
  if (entries.length < 2) return <p className="text-xs text-[#8a8a8a]">Log at least two entries to see your trend.</p>;
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

function Input({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <div>
      <label className="label-cap block mb-1">{label}</label>
      <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} className="input-grit" />
    </div>
  );
}

function ScanModal({ scan, onClose }: { scan: PhysiqueScan; onClose: () => void }) {
  const a = scan.analysis;
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 overflow-auto" onClick={onClose}>
      <div className="min-h-screen max-w-md mx-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <p className="label-cap">SCAN {scan.date.slice(0, 10)}</p>
          <button onClick={onClose} className="text-grit"><X size={22} /></button>
        </div>
        <img src={scan.photoDataUrl} alt="" className="w-full border border-grit mb-4" />
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="BF%" value={`${a.bodyFatEstimate}`} accent />
          <Stat label="MUSCLE" value={`${a.muscleScore}`} />
          <Stat label="SYMMETRY" value={`${a.symmetryScore}`} />
        </div>
        <div className="bg-grit-card border border-accent-red p-4 mb-4">
          <p className="label-cap text-accent-red text-[10px]">VERDICT</p>
          <p className="display text-base uppercase font-extrabold text-grit mt-1">{a.verdict}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 mb-4">
          <Block title="STRENGTHS" items={a.strengths} color="#7acc7a" />
          <Block title="WEAKNESSES" items={a.weaknesses} color="#e63222" />
          <Block title="FOCUS NEXT" items={a.focus} color="#f5f5f0" />
        </div>
        {a.leanMassNote && (
          <p className="text-xs text-grit-dim uppercase tracking-wider mb-6">{a.leanMassNote}</p>
        )}
      </div>
    </div>
  );
}

function Block({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="bg-grit-card border border-grit p-3">
      <p className="label-cap text-[10px]" style={{ color }}>{title}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs uppercase font-bold tracking-wide text-grit">— {it}</li>
        ))}
      </ul>
    </div>
  );
}

async function downscale(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      res(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}
