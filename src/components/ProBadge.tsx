import { Crown } from "lucide-react";

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm bg-accent-red/15 border border-accent-red/40 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-widest text-accent-red ${className}`}
    >
      <Crown size={9} strokeWidth={3} />
      Pro
    </span>
  );
}
