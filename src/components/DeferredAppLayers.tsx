import { AchievementWatcher } from "./AchievementWatcher";
import { AppReviewWatcher } from "./AppReviewWatcher";
import { DeviceReminderSync } from "./DeviceReminderSync";
import { FeedbackPulse } from "./FeedbackPulse";
import { FirstWeekActivationNudge } from "./FirstWeekActivationNudge";
import { ProWelcome } from "./ProWelcome";
import { StreakMilestoneWatcher } from "./StreakMilestoneWatcher";
import { TonnageMilestoneWatcher } from "./TonnageMilestoneWatcher";
import { UpgradeNudge } from "./UpgradeNudge";
import { WeeklyRecapNudge } from "./WeeklyRecapNudge";

/**
 * Helpful but non-critical engagement surfaces. Keeping them behind one lazy
 * boundary means the plan, logger and sync path paint before milestone scans,
 * review eligibility and recap prompts do any work.
 */
export function DeferredAppLayers() {
  return (
    <>
      <ProWelcome />
      <UpgradeNudge />
      <StreakMilestoneWatcher />
      <AchievementWatcher />
      <TonnageMilestoneWatcher />
      <WeeklyRecapNudge />
      <FirstWeekActivationNudge />
      <FeedbackPulse />
      <DeviceReminderSync />
      <AppReviewWatcher />
    </>
  );
}
