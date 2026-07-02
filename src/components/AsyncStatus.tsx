import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";

type Props = {
  /** True while the async action is running. */
  loading?: boolean;
  /** Message to show while loading. */
  loadingLabel?: string;
  /** Error message to render as an error card. Null/undefined = no error. */
  error?: string | null;
  /** Retry handler. If omitted the retry button is hidden. */
  onRetry?: () => void;
  /** Label for the retry button (default "Try again"). */
  retryLabel?: string;
  /** Optional compact variant for inline placement. */
  compact?: boolean;
};

/**
 * Unified async loading / error UI. Every async user-triggered action
 * (AI scan, generation, fetch) should render this instead of ad-hoc
 * <p>error</p> or silent failure. Provides visible progress and a
 * retry path so users never hit a dead end.
 */
export function AsyncStatus({
  loading,
  loadingLabel = "Working…",
  error,
  onRetry,
  retryLabel = "Try again",
  compact = false,
}: Props) {
  if (loading) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-xs text-grit-dim label-cap">
          <Loader2 size={12} className="animate-spin text-accent-red" />
          {loadingLabel}
        </div>
      );
    }
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-2xl"
        style={{ background: "#141414", border: "1px solid #262626" }}
        role="status"
        aria-live="polite"
      >
        <Loader2 size={16} className="animate-spin text-accent-red flex-shrink-0" />
        <span className="text-xs text-grit label-cap">{loadingLabel}</span>
      </div>
    );
  }

  if (!error) return null;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-accent-red flex items-center gap-1 min-w-0">
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="label-cap text-[10px] text-grit underline flex-shrink-0"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl"
      style={{ background: "rgba(225,6,0,0.06)", border: "1px solid rgba(225,6,0,0.4)" }}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-accent-red flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="label-cap text-[11px] text-accent-red">Something went wrong</p>
          <p className="text-xs text-grit-dim mt-0.5 break-words">{error}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="self-start flex items-center gap-1.5 label-cap text-[11px] text-grit border border-grit px-3 py-1.5 rounded-2xl hover:border-accent-red transition-colors"
        >
          <RotateCcw size={11} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
