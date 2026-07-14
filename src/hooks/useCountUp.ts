import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to the target — makes stat
 * tiles feel alive. Respects prefers-reduced-motion (jumps instantly).
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !Number.isFinite(target)) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      // Keep the live value as the next animation's starting point so a
      // retarget mid-flight never snaps backwards.
      fromRef.current = value;
      setDisplay(value);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return display;
}
