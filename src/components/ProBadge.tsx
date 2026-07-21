import { Crown } from "lucide-react";

/**
 * The gold DEADSET PRO badge — the single, unmistakable marker of Pro status.
 * Used next to the athlete name, on the FIFA card, and anywhere Pro identity shows.
 */
export function ProBadge({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { text: "text-[8px]", pad: "px-1 py-[1px]", icon: 8 },
    md: { text: "text-[10px]", pad: "px-1.5 py-0.5", icon: 10 },
    lg: { text: "text-xs", pad: "px-2 py-1", icon: 12 },
  }[size];
  return (
    <span className={`pro-chip ${dims.text} ${dims.pad} ${className}`}>
      <Crown size={dims.icon} strokeWidth={2.75} />
      Pro
    </span>
  );
}
