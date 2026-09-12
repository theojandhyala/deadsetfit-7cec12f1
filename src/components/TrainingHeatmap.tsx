import type { AppState } from "@/lib/types";
import { TrainingCalendar } from "./TrainingCalendar";

/** Compatibility entry point for the Progress screen's training history. */
export function TrainingHeatmap({ state }: { state: AppState }) {
  return <TrainingCalendar state={state} />;
}
