import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function QuickLogFAB() {
  return (
    <Link
      to="/workout/live"
      aria-label="Start workout"
      className="fixed right-4 z-40 inline-flex items-center gap-2 px-4 py-3 bg-accent-red text-white font-extrabold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
      style={{
        bottom: "calc(80px + env(safe-area-inset-bottom))",
        boxShadow: "0 8px 24px rgba(230,50,34,0.45)",
      }}
    >
      <Zap size={16} strokeWidth={3} />
      <span className="display">Start</span>
    </Link>
  );
}
