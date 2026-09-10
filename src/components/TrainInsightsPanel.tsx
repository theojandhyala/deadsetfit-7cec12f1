import { Big3Card } from "./Big3Card";
import { ProBanner } from "./ProBanner";
import { RankedArena } from "./RankedArena";
import { StreakChaseCard } from "./StreakChaseCard";
import { TrainingInsight } from "./TrainingInsight";
import { WeekPaceCard } from "./WeekPaceCard";
import { WeeklyRecap } from "./WeeklyRecap";
import { WeeklyReportCard } from "./WeeklyReportCard";
import type { AppState } from "../lib/types";

/** Data-rich analysis loaded only when the athlete asks to see Insights. */
export function TrainInsightsPanel({ state }: { state: AppState }) {
  return (
    <div id="train-insights-panel" role="tabpanel" className="deadset-view-switch flex flex-col">
      <div className="px-5">
        <TrainingInsight />
        <WeekPaceCard state={state} />
        <StreakChaseCard state={state} />
      </div>
      <WeeklyReportCard />
      <ProBanner />
      <section className="deadset-section">
        <RankedArena state={state} compact />
      </section>
      <div className="deadset-section">
        <Big3Card state={state} />
      </div>
      <div className="deadset-section">
        <WeeklyRecap state={state} />
      </div>
    </div>
  );
}
