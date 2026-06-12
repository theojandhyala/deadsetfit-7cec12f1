import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import type { WorkoutSession } from "@/lib/types";

// 9:16 TikTok / Reels / Shorts ready (1080 x 1920)
export function ShareCard({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = 1080,
      h = 1920;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    // Background — deep black with subtle vertical gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0a0a");
    bg.addColorStop(1, "#141414");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Top + bottom safe-zone hint rails (TikTok UI overlays the edges)
    ctx.fillStyle = "#E10600";
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);

    // Diagonal red wedge top-right
    ctx.fillStyle = "#E10600";
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, 520);
    ctx.lineTo(w - 360, 0);
    ctx.closePath();
    ctx.fill();

    // Brand
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 120px Impact, 'Arial Black', sans-serif";
    ctx.fillText("DEADSET", 70, 230);
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("FORGE YOUR BODY", 70, 285);

    // Session complete badge
    ctx.fillStyle = "#E10600";
    ctx.font = "700 38px Arial, sans-serif";
    ctx.fillText("SESSION COMPLETE", 70, 460);

    // Big workout label (wrap to 2 lines if needed)
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 130px Impact, 'Arial Black', sans-serif";
    const label = session.label.toUpperCase().split(" — ")[0].slice(0, 22);
    ctx.fillText(label, 70, 600);

    // Stats grid 2x2 — large for vertical
    const stats = [
      { k: "PUMP", v: session.pumpScore != null ? String(session.pumpScore) : "—" },
      { k: "PRs", v: String(session.prCount) },
      { k: "VOLUME KG", v: session.totalVolume.toLocaleString() },
      { k: "SETS", v: String(session.exercises.reduce((s, e) => s + e.sets.length, 0)) },
    ];
    const gridTop = 760;
    const cellW = 460,
      cellH = 280,
      gap = 20;
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 70 + col * (cellW + gap);
      const y = gridTop + row * (cellH + gap);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cellW, cellH);
      ctx.fillStyle = "#E10600";
      ctx.font = "700 30px Arial, sans-serif";
      ctx.fillText(s.k, x + 28, y + 62);
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "900 150px Impact, 'Arial Black', sans-serif";
      ctx.fillText(s.v, x + 28, y + 220);
    });

    // Pump note quote
    if (session.pumpNote) {
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "700 38px Arial, sans-serif";
      const note = session.pumpNote.toUpperCase().slice(0, 50);
      ctx.fillText(`"${note}"`, 70, 1450);
    }

    // Date
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText(new Date(session.startedAt).toDateString().toUpperCase(), 70, 1540);

    // CTA bottom
    ctx.fillStyle = "#E10600";
    ctx.fillRect(70, 1670, w - 140, 4);
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 76px Impact, 'Arial Black', sans-serif";
    ctx.fillText("YOUR TURN.", 70, 1770);
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText("DEADSETFIT.ORG", 70, 1820);

    setDataUrl(c.toDataURL("image/png"));
  }, [session]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-session.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: "Just crushed a session. #deadset #gymtok",
        });
        return;
      }
    } catch {
      /* fallthrough */
    }
    download();
  }
  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-${session.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <p className="label-cap text-grit">9:16 · TIKTOK READY</p>
        <button onClick={onClose} className="text-grit">
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-5" onClick={(e) => e.stopPropagation()}>
        {dataUrl && (
          <img
            src={dataUrl}
            alt="Share card"
            className="w-full max-w-[360px] mx-auto border border-grit"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[11px] text-grit-dim text-center mt-3 max-w-xs mx-auto">
          Save it, then post to TikTok / Reels / Shorts. Tag{" "}
          <span className="text-grit font-bold">#deadset</span>.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4 max-w-md mx-auto">
          <button onClick={download} className="btn-ghost">
            <Download size={16} className="mr-2" />
            Save
          </button>
          <button onClick={shareNow} className="btn-grit">
            <Share2 size={16} className="mr-2" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
