import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function QuickLogFAB() {
  return (
    <>
      {/* Reserve scroll space so the fixed FAB never overlaps card content
          (grids, list rows, chevrons) at the bottom of the page. */}
      <div aria-hidden className="h-24 w-full shrink-0" />
      <Link
        to="/workout/live"
        aria-label="Start workout"
        className="inline-flex fixed right-4 z-30 items-center gap-2 rounded-full px-4 py-3 bg-accent-red text-white font-extrabold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform"
        style={{
          bottom: "calc(78px + env(safe-area-inset-bottom))",
          boxShadow: "0 10px 28px rgba(230,50,34,0.32)",
        }}
      >
        <Zap size={16} strokeWidth={3} />
        <span className="display">Start</span>
      </Link>
    </>
  );
}
