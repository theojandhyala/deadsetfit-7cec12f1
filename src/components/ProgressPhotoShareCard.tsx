import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import { getInviteUrl } from "@/lib/referral";
import { PHOTO_CARD_H, PHOTO_CARD_W, drawPhotoCard } from "@/lib/photo-card-draw";
import { spanLabel } from "@/lib/progress-photos";
import type { WeightUnit } from "@/lib/units";

/**
 * The before-and-after card: your own body, then and now.
 *
 * The one artefact in the app a person genuinely wants to post about
 * themselves, so it is built to be posted — 1080x1920, clear of the caption
 * strip, carrying an invite link.
 *
 * Nothing leaves the device to make it. The photos are already local data
 * URLs; the card is drawn on a canvas here and handed to the system share
 * sheet, so a person deciding not to post it means it was never anywhere.
 */
export function ProgressPhotoShareCard({
  beforeSrc,
  nowSrc,
  beforeDate,
  nowDate,
  daysApart,
  weightDeltaKg,
  unit,
  displayName,
  onClose,
}: {
  beforeSrc: string;
  nowSrc: string;
  beforeDate: string;
  nowDate: string;
  daysApart: number;
  weightDeltaKg: number | null;
  unit: WeightUnit;
  displayName: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not read that photo."));
        image.src = src;
      });

    void (async () => {
      try {
        // Both must decode before anything is drawn — canvas cannot await
        // mid-composition, and a half-drawn card is worse than a spinner.
        const [before, now] = await Promise.all([load(beforeSrc), load(nowSrc)]);
        if (cancelled) return;
        canvas.width = PHOTO_CARD_W;
        canvas.height = PHOTO_CARD_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawPhotoCard(ctx, {
          before,
          now,
          beforeDate,
          nowDate,
          daysApart,
          weightDeltaKg,
          unit,
          displayName,
        });
        setDataUrl(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [beforeSrc, nowSrc, beforeDate, nowDate, daysApart, weightDeltaKg, unit, displayName]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-progress.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${spanLabel(daysApart)}. Put in the work → ${invite} #deadset #gymtok #transformation`,
        });
        return;
      }
    } catch (error) {
      // Cancelling the native share sheet is not a failure — do not then
      // silently drop a file into their downloads.
      if (error instanceof Error && error.name === "AbortError") return;
    }
    download();
  }

  function download() {
    if (!dataUrl) return;
    if (Capacitor.isNativePlatform()) {
      toast.message("Use Share to save this", {
        description: "The share sheet can save it straight to Photos.",
      });
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "deadset-progress.jpg";
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 px-5 py-6">
      <div className="flex items-center justify-between">
        <p className="label-cap text-[10px] text-grit-dim">
          YOUR PROGRESS · {spanLabel(daysApart).toUpperCase()}
        </p>
        <button onClick={onClose} aria-label="Close" className="p-2 text-grit-dim press">
          <X size={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        {failed ? (
          <p className="max-w-xs text-center text-sm leading-relaxed text-grit-dim">
            One of those photos could not be read, so there is nothing to share. Try another pair.
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full rounded-2xl border border-grit object-contain"
            style={{ aspectRatio: `${PHOTO_CARD_W} / ${PHOTO_CARD_H}` }}
          />
        )}
      </div>

      <p className="mb-3 text-center text-[11px] leading-relaxed text-grit-dim">
        Nothing is posted anywhere until you choose to. This card is made on your phone.
      </p>

      <div className="flex gap-2">
        <button onClick={download} disabled={!dataUrl} className="btn-ghost min-h-12 flex-1">
          <Download size={16} className="mr-2" />
          Save
        </button>
        <button onClick={shareNow} disabled={!dataUrl} className="btn-grit min-h-12 flex-1">
          <Share2 size={16} className="mr-2" />
          Share
        </button>
      </div>
    </div>
  );
}
