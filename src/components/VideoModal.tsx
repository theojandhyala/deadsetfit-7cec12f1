import { X, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

interface Props {
  videoId?: string;
  query?: string;
  title?: string;
  clipStart?: number;
  clipEnd?: number;
  cue?: string;
  onClose: () => void;
}

export function VideoModal({ videoId, query, title, clipStart, clipEnd, cue, onClose }: Props) {
  const [muted, setMuted] = useState(true);
  const start = clipStart ?? 5;
  const end = clipEnd ?? start + 12;

  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    controls: "0",
    mute: muted ? "1" : "0",
    loop: "1",
    start: String(start),
    end: String(end),
  });

  let src: string;
  if (videoId) {
    params.set("playlist", videoId); // required for loop=1
    src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  } else {
    src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query ?? "")}&autoplay=1&mute=1`;
  }

  const heading = title ?? query ?? "FORM CLIP";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-2xl bg-grit-card border border-grit" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-grit">
          <div className="min-w-0">
            <p className="label-cap text-[9px] text-accent-red">ACTION CLIP · LOOPING</p>
            <h3 className="font-display uppercase tracking-wider text-grit text-lg truncate">{heading}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {videoId && (
              <button
                onClick={() => setMuted((m) => !m)}
                className="text-grit-dim hover:text-grit p-1"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button onClick={onClose} className="text-grit p-1" aria-label="Close">
              <X size={22} />
            </button>
          </div>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            key={`${videoId}-${muted}`}
            className="w-full h-full"
            src={src}
            title={heading}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        {cue && (
          <div className="px-4 py-3 border-t border-grit">
            <p className="label-cap text-[9px] text-accent-red mb-1">FORM CUE</p>
            <p className="text-sm text-grit leading-snug">{cue}</p>
          </div>
        )}
      </div>
    </div>
  );
}
