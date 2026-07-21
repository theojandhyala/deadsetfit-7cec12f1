import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export interface WeeklyRecap {
  weekLabel: string;
  sessions: number;
  volumeKg: number;
  prs: number;
  streak: number;
  topLift?: { name: string; value: number };
}

// 9:16 story-ready recap of the training week.
export function WeeklyRecapCard({ recap, onClose }: { recap: WeeklyRecap; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = 1080;
    const h = 1920;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0a0a");
    bg.addColorStop(1, "#141414");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e63222";
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, 520);
    ctx.lineTo(w - 360, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 120px Impact, 'Arial Black', sans-serif";
    ctx.fillText("DEADSET", 70, 230);
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("FORGE YOUR BODY", 70, 285);

    ctx.fillStyle = "#e63222";
    ctx.font = "700 38px Arial, sans-serif";
    ctx.fillText("MY WEEK", 70, 460);
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 120px Impact, 'Arial Black', sans-serif";
    ctx.fillText(recap.weekLabel.toUpperCase().slice(0, 22), 70, 585);

    // Stat rows
    const rows: [string, string][] = [
      ["SESSIONS", String(recap.sessions)],
      ["VOLUME LIFTED", `${Math.round(recap.volumeKg).toLocaleString()} kg`],
      ["NEW PRS", String(recap.prs)],
      ["DAY STREAK", String(recap.streak)],
    ];
    let y = 820;
    for (const [label, value] of rows) {
      ctx.fillStyle = "#8a8a8a";
      ctx.font = "700 40px Arial, sans-serif";
      ctx.fillText(label, 70, y);
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "900 96px Impact, 'Arial Black', sans-serif";
      ctx.fillText(value, 70, y + 100);
      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(70, y + 150);
      ctx.lineTo(w - 70, y + 150);
      ctx.stroke();
      y += 230;
    }

    if (recap.topLift) {
      ctx.fillStyle = "#e63222";
      ctx.font = "700 36px Arial, sans-serif";
      ctx.fillText("TOP LIFT OF THE WEEK", 70, y + 20);
      ctx.fillStyle = "#f5f5f0";
      ctx.font = "900 72px Impact, 'Arial Black', sans-serif";
      ctx.fillText(`${recap.topLift.name.toUpperCase()} · ${recap.topLift.value}KG`, 70, y + 110);
    }

    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillText("DEADSETFIT.ORG  ·  #DEADSET", 70, h - 90);

    setDataUrl(c.toDataURL("image/png"));
  }, [recap]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-week.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: "My training week. #deadset #gymtok",
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
    if (Capacitor.isNativePlatform()) {
      toast.error("Use the share sheet to save the image");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "deadset-week.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <p className="label-cap text-grit">9:16 · STORY READY</p>
        <button onClick={onClose} className="text-grit">
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-5" onClick={(e) => e.stopPropagation()}>
        {dataUrl && (
          <img src={dataUrl} alt="Weekly recap" className="w-full max-w-[360px] mx-auto border border-grit" />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[11px] text-grit-dim text-center mt-3 max-w-xs mx-auto">
          Post your week to Stories / Reels / TikTok. Tag{" "}
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
