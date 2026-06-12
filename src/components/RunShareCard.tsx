import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import type { Run } from "@/lib/types";
import { formatDuration, formatPace } from "@/lib/run";

export function RunShareCard({ run, onClose }: { run: Run; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = 1080, H = 1920;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0A0A0A");
    bg.addColorStop(1, "#141414");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Red accent stripe top
    ctx.fillStyle = "#E10600";
    ctx.fillRect(0, 0, W, 14);

    // Red diagonal wedge top-right
    ctx.fillStyle = "#E10600";
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W, 480);
    ctx.lineTo(W - 320, 0);
    ctx.closePath();
    ctx.fill();

    // Brand
    ctx.fillStyle = "#FAFAFA";
    ctx.font = "900 128px Impact, 'Arial Black', sans-serif";
    ctx.fillText("DEADSET", 72, 230);
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillStyle = "#8A8A8A";
    ctx.fillText("FORGE YOUR BODY", 72, 278);

    // Activity badge
    const actLabel = (run.activityType ?? "run").toUpperCase();
    ctx.fillStyle = "#E10600";
    ctx.font = "700 36px Arial, sans-serif";
    ctx.fillText(`${actLabel} COMPLETE`, 72, 430);

    // Run name
    ctx.fillStyle = "#FAFAFA";
    ctx.font = "900 118px Impact, 'Arial Black', sans-serif";
    const name = (run.name ?? "Activity").toUpperCase().slice(0, 22);
    ctx.fillText(name, 72, 575);

    // Route trace — normalize coords to fit box
    const routeTop = 630, routeH = 560, routeW = W - 144;
    if (run.samples.length >= 2) {
      const lats = run.samples.map(s => s.lat);
      const lngs = run.samples.map(s => s.lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const padFrac = 0.12;
      const dLat = maxLat - minLat || 0.001;
      const dLng = maxLng - minLng || 0.001;
      const aspect = dLng / dLat;
      let boxW = routeW, boxH = routeH;
      if (aspect > routeW / routeH) boxH = routeW / aspect;
      else boxW = routeH * aspect;
      const ox = 72 + (routeW - boxW) / 2;
      const oy = routeTop + (routeH - boxH) / 2;
      const pad = Math.min(boxW, boxH) * padFrac;
      const scaleX = (boxW - pad * 2) / dLng;
      const scaleY = (boxH - pad * 2) / dLat;

      const toX = (lng: number) => ox + pad + (lng - minLng) * scaleX;
      const toY = (lat: number) => oy + boxH - pad - (lat - minLat) * scaleY;

      // Grid lines
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        const gx = ox + (routeW / 6) * i;
        ctx.beginPath(); ctx.moveTo(gx, routeTop); ctx.lineTo(gx, routeTop + routeH); ctx.stroke();
      }
      for (let i = 1; i < 5; i++) {
        const gy = routeTop + (routeH / 5) * i;
        ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + routeW, gy); ctx.stroke();
      }

      // Glow path
      ctx.save();
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#E10600";
      ctx.globalAlpha = 0.2;
      ctx.filter = "blur(8px)";
      ctx.beginPath();
      run.samples.forEach((s, i) => {
        if (i === 0) ctx.moveTo(toX(s.lng), toY(s.lat));
        else ctx.lineTo(toX(s.lng), toY(s.lat));
      });
      ctx.stroke();
      ctx.restore();

      // Crisp path
      ctx.save();
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#FF1A1A";
      ctx.globalAlpha = 1;
      ctx.beginPath();
      run.samples.forEach((s, i) => {
        if (i === 0) ctx.moveTo(toX(s.lng), toY(s.lat));
        else ctx.lineTo(toX(s.lng), toY(s.lat));
      });
      ctx.stroke();
      ctx.restore();

      // Start dot
      const s0 = run.samples[0];
      ctx.beginPath();
      ctx.arc(toX(s0.lng), toY(s0.lat), 18, 0, Math.PI * 2);
      ctx.fillStyle = "#0A0A0A";
      ctx.fill();
      ctx.strokeStyle = "#FAFAFA";
      ctx.lineWidth = 5;
      ctx.stroke();

      // End dot
      const sN = run.samples[run.samples.length - 1];
      ctx.beginPath();
      ctx.arc(toX(sN.lng), toY(sN.lat), 22, 0, Math.PI * 2);
      ctx.fillStyle = "#E10600";
      ctx.fill();
      ctx.strokeStyle = "#FAFAFA";
      ctx.lineWidth = 5;
      ctx.stroke();
    } else {
      // No GPS data — just a placeholder
      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 2;
      ctx.strokeRect(72, routeTop, routeW, routeH);
      ctx.fillStyle = "#8A8A8A";
      ctx.font = "700 32px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NO GPS DATA", W / 2, routeTop + routeH / 2);
      ctx.textAlign = "left";
    }

    // Stats grid 2×2
    const statsTop = routeTop + routeH + 40;
    const stats = [
      { k: "DISTANCE", v: `${(run.distanceM / 1000).toFixed(2)}`, u: "km" },
      { k: "TIME", v: formatDuration(run.durationSec), u: "" },
      {
        k: run.activityType === "cycle" ? "SPEED" : "PACE",
        v: run.activityType === "cycle"
          ? `${((run.distanceM / run.durationSec) * 3.6).toFixed(1)}`
          : formatPace(run.avgPaceSecPerKm ?? 0),
        u: run.activityType === "cycle" ? "km/h" : "/km",
      },
      { k: "CALORIES", v: String(run.calories ?? Math.round(run.distanceM / 1000 * 70)), u: "kcal" },
    ];
    const cW = (W - 144 - 20) / 2, cH = 260;
    stats.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 72 + col * (cW + 20);
      const y = statsTop + row * (cH + 20);
      ctx.fillStyle = "#141414";
      ctx.fillRect(x, y, cW, cH);
      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cW, cH);
      // Left accent
      ctx.fillStyle = "#E10600";
      ctx.fillRect(x, y, 8, cH);
      ctx.fillStyle = "#E10600";
      ctx.font = "700 28px Arial, sans-serif";
      ctx.fillText(s.k, x + 30, y + 58);
      ctx.fillStyle = "#FAFAFA";
      ctx.font = `900 ${s.v.length > 6 ? 88 : 108}px Impact, 'Arial Black', sans-serif`;
      ctx.fillText(s.v, x + 30, y + 188);
      if (s.u) {
        ctx.fillStyle = "#8A8A8A";
        ctx.font = "700 28px Arial, sans-serif";
        ctx.fillText(s.u, x + 30, y + 230);
      }
    });

    // Date
    const dateY = statsTop + 2 * (cH + 20) + 60;
    ctx.fillStyle = "#8A8A8A";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText(new Date(run.date).toDateString().toUpperCase(), 72, dateY);

    // Splits teaser
    if (run.splits.length > 0) {
      const splitsTop = dateY + 50;
      ctx.fillStyle = "#8A8A8A";
      ctx.font = "700 24px Arial, sans-serif";
      ctx.fillText("KM SPLITS", 72, splitsTop);
      const maxS = Math.max(...run.splits);
      run.splits.slice(0, 6).forEach((sec, i) => {
        const bx = 72, by = splitsTop + 16 + i * 38;
        const bw = 600 * (sec / maxS);
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(bx, by, 600, 28);
        ctx.fillStyle = i === run.splits.indexOf(Math.min(...run.splits)) ? "#E10600" : "#2a2a2a";
        ctx.fillRect(bx, by, bw, 28);
        ctx.fillStyle = "#FAFAFA";
        ctx.font = "700 22px Arial, sans-serif";
        ctx.fillText(`${i + 1}  ${formatPace(sec)}/km`, bx + 620, by + 22);
      });
    }

    // CTA
    ctx.fillStyle = "#E10600";
    ctx.fillRect(72, H - 260, W - 144, 4);
    ctx.fillStyle = "#FAFAFA";
    ctx.font = "900 88px Impact, 'Arial Black', sans-serif";
    ctx.fillText("YOUR TURN.", 72, H - 148);
    ctx.fillStyle = "#8A8A8A";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText("DEADSETFIT.ORG", 72, H - 96);

    // Bottom stripe
    ctx.fillStyle = "#E10600";
    ctx.fillRect(0, H - 14, W, 14);

    setDataUrl(c.toDataURL("image/png"));
  }, [run]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-run.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${(run.distanceM / 1000).toFixed(2)} km in ${formatDuration(run.durationSec)} 🔥 #deadset`,
        });
        return;
      }
    } catch { /* fallthrough */ }
    download();
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-run-${run.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.97)" }}
      onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="label-cap text-[10px] font-bold" style={{ color: "#8A8A8A" }}>
          9:16 · TIKTOK / REELS READY
        </p>
        <button onClick={onClose} style={{ color: "#8A8A8A" }}>
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {dataUrl ? (
          <img src={dataUrl} alt="Run share card"
            className="w-full mx-auto" style={{ maxWidth: 340, border: "1px solid #262626" }} />
        ) : (
          <div className="flex items-center justify-center h-48" style={{ color: "#8A8A8A" }}>
            <span className="text-xs uppercase tracking-widest">Rendering…</span>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[11px] text-center mt-3" style={{ color: "#8A8A8A" }}>
          Save and post to TikTok · Reels · Shorts.{" "}
          <span className="font-bold" style={{ color: "#FAFAFA" }}>#deadset</span>
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4" style={{ maxWidth: 400, margin: "16px auto 0" }}>
          <button onClick={download}
            className="py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
            style={{ background: "#141414", border: "1px solid #262626", color: "#FAFAFA" }}>
            <Download size={15} /> Save
          </button>
          <button onClick={shareNow}
            className="py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-white"
            style={{ background: "#E10600" }}>
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
