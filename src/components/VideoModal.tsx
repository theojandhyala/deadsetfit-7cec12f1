import { X } from "lucide-react";

interface Props {
  videoId?: string;
  query?: string;
  title?: string;
  onClose: () => void;
}

export function VideoModal({ videoId, query, title, onClose }: Props) {
  const src = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query ?? "")}&autoplay=1`;
  const heading = title ?? query ?? "FORM VIDEO";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-2xl bg-grit-card border border-grit" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-grit">
          <h3 className="font-display uppercase tracking-wider text-grit text-lg truncate">{heading}</h3>
          <button onClick={onClose} className="text-grit p-1"><X size={22} /></button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            className="w-full h-full"
            src={src}
            title={heading}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
