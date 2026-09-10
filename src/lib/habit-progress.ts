/** Honest progress against the athlete's existing target; never mark 80/90% as done. */
export function habitProgress(value: number, target: number) {
  const current = Number.isFinite(value) ? Math.max(0, value) : 0;
  const validTarget = Number.isFinite(target) && target > 0;
  return {
    current,
    percent: validTarget ? Math.min(100, Math.floor((current / target) * 100)) : 0,
    complete: validTarget && current >= target,
  };
}
