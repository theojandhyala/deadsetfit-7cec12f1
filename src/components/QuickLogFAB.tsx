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
        search={{}}
        aria-label="Start workout"
        className="fixed right-4 z-30 inline-flex items-center gap-2 rounded-md border border-white/20 bg-accent-red px-4 py-3 text-xs font-extrabold uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95"
        style={{
          bottom: "calc(78px + env(safe-area-inset-bottom))",
          boxShadow: "0 10px 28px rgba(230,50,34,0.26), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        <Zap size={16} strokeWidth={3} />
        <span className="display">Start</span>
      </Link>
    </>
  );
}
