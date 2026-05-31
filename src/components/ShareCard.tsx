import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import type { WorkoutSession } from "@/lib/types";

export function ShareCard({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = 1080, h = 1350;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    // Background
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, w, h);
    // Red accent block
    ctx.fillStyle = "#e63222"; ctx.fillRect(0, 0, w, 12);
    ctx.fillRect(0, h - 12, w, 12);
    // Diagonal red wedge
    ctx.fillStyle = "#e63222";
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, 380); ctx.lineTo(w - 260, 0); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 88px Impact, 'Arial Black', sans-serif";
    ctx.fillText("DEADSET", 70, 150);
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("FORGE YOUR BODY", 70, 195);

    ctx.fillStyle = "#e63222";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText("SESSION COMPLETE", 70, 320);

    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 96px Impact, 'Arial Black', sans-serif";
    const label = session.label.toUpperCase().slice(0, 22);
    ctx.fillText(label, 70, 430);

    // Stats grid
    const stats = [
      { k: "PUMP SCORE", v: session.pumpScore != null ? String(session.pumpScore) : "—" },
      { k: "VOLUME (KG)", v: session.totalVolume.toLocaleString() },
      { k: "SETS", v: String(session.exercises.reduce((s, e) => s + e.sets.length, 0)) },
      { k: "PRS", v: String(session.prCount) },
    ];
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 70 + col * 480;
      const y = 560 + row * 240;
      ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x, y, 460, 210);
      ctx.strokeStyle = "#262626"; ctx.lineWidth = 2; ctx.strokeRect(x, y, 460, 210);
      ctx.fillStyle = "#e63222";
      ctx.font = "700 24px Arial, sans-serif";
      ctx.fillText(s.k, x + 28, y + 50);
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "900 110px Impact, 'Arial Black', sans-serif";
      ctx.fillText(s.v, x + 28, y + 170);
    });

    if (session.pumpNote) {
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "700 30px Arial, sans-serif";
      const note = session.pumpNote.toUpperCase().slice(0, 60);
      ctx.fillText(`"${note}"`, 70, 1120);
    }

    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText(new Date(session.startedAt).toDateString().toUpperCase(), 70, 1230);

    setDataUrl(c.toDataURL("image/png"));
  }, [session]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "grit-session.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "DEADSET", text: "Just crushed a session." });
        return;
      }
    } catch { /* fallthrough */ }
    download();
  }
  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `grit-${session.id}.png`; a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <p className="label-cap text-grit">SHARE CARD</p>
        <button onClick={onClose} className="text-grit"><X size={22} /></button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-5" onClick={(e) => e.stopPropagation()}>
        {dataUrl && <img src={dataUrl} alt="Share card" className="w-full border border-grit" />}
        <canvas ref={canvasRef} className="hidden" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button onClick={download} className="btn-ghost"><Download size={16} className="mr-2" />Save</button>
          <button onClick={shareNow} className="btn-grit"><Share2 size={16} className="mr-2" />Share</button>
        </div>
      </div>
    </div>
  );
}
