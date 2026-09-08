/** Lightweight route fallback. The caller owns readiness; this never adds a timer. */
export function AppLoading({ label = "Opening your training" }: { label?: string }) {
  return (
    <div
      className="deadset-loading grid min-h-[65dvh] place-items-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-56">
        <p
          className="display text-4xl font-black italic tracking-tight text-grit"
          aria-label="DEADSET"
        >
          DEAD<span className="text-accent-red">SET</span>
        </p>
        <div className="deadset-loading-track mt-5" aria-hidden="true">
          <span />
        </div>
        <p className="mt-4 text-xs text-grit-dim">{label}</p>
      </div>
    </div>
  );
}
