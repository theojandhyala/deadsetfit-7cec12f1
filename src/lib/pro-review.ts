import type { AppState } from "./types";
import { allInsights, muscleBalance, strengthGoalRoadmaps, weeklyVolume } from "./pro-intelligence";
import { currentWeekReport, type WeeklyReport } from "./weekly-report";

export type ReviewRoute = "/plan" | "/progress" | "/train";

export interface ReviewAction {
  id: string;
  tone: "urgent" | "progress" | "ready";
  title: string;
  detail: string;
  label: string;
  to: ReviewRoute;
}

export interface ProReview {
  score: number;
  grade: WeeklyReport["grade"];
  headline: string;
  actions: ReviewAction[];
  wins: Array<{ value: string; label: string; positive: boolean }>;
}

const GRADE_SCORE: Record<WeeklyReport["grade"], number> = {
  A: 94,
  B: 80,
  C: 65,
  D: 48,
  F: 25,
};

/** A deterministic weekly decision layer built only from the athlete's own logs. */
export function buildProReview(state: AppState, now = Date.now()): ProReview {
  const report = currentWeekReport(state, new Date(now));
  const insights = allInsights(state, now);
  const balance = muscleBalance(state, now);
  const volume = weeklyVolume(state, now);
  const goals = strengthGoalRoadmaps(state, now);
  const actions: ReviewAction[] = [];

  if (!state.schedule) {
    actions.push({
      id: "build-plan",
      tone: "urgent",
      title: "Build your training week",
      detail: "Set your days, exercises, sets and rep targets before the next session.",
      label: "Build plan",
      to: "/plan",
    });
  }

  for (const insight of insights.filter((item) => item.tone !== "good").slice(0, 2)) {
    actions.push({
      id: `${insight.title}-${actions.length}`,
      tone: insight.tone === "warn" ? "urgent" : "progress",
      title: insight.title,
      detail: insight.message,
      label: insight.tone === "warn" ? "Review data" : "Open progress",
      to: "/progress",
    });
  }

  const nearestGoal = goals
    .filter((goal) => !goal.reached)
    .sort((a, b) => a.remainingKg - b.remainingKg)[0];
  if (nearestGoal && actions.length < 3) {
    actions.push({
      id: `goal-${nearestGoal.exerciseId}`,
      tone: "progress",
      title: `${nearestGoal.remainingKg}kg from ${nearestGoal.name} target`,
      detail: nearestGoal.etaDate
        ? `Current trend projects ${nearestGoal.targetKg}kg around ${new Date(nearestGoal.etaDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
        : `Keep logging this lift to build a reliable target date.`,
      label: "View roadmap",
      to: "/progress",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "train",
      tone: "ready",
      title: "No corrections needed",
      detail: "Your volume and recent lift trends are on track. Run the next planned session.",
      label: "Start training",
      to: "/train",
    });
  }

  const optimalMuscles = volume.filter((item) => item.zone === "OPTIMAL").length;
  const wins = [
    {
      value: String(report.sessions),
      label: `session${report.sessions === 1 ? "" : "s"} this week`,
      positive: report.sessions > 0,
    },
    {
      value: String(report.prs),
      label: `personal record${report.prs === 1 ? "" : "s"}`,
      positive: report.prs > 0,
    },
    balance.hasData
      ? {
          value: String(balance.score),
          label: "training balance",
          positive: balance.score >= 70,
        }
      : {
          value: `${optimalMuscles}/6`,
          label: "muscles in range",
          positive: optimalMuscles > 0,
        },
  ];

  const actionPenalty = actions.filter((action) => action.tone === "urgent").length * 6;
  const balanceAdjustment = balance.hasData ? Math.round((balance.score - 70) / 8) : 0;
  const score = Math.max(
    0,
    Math.min(100, GRADE_SCORE[report.grade] - actionPenalty + balanceAdjustment),
  );
  const headline =
    actions[0].tone === "ready"
      ? "Stay the course. Your training is moving."
      : `${actions.length} clear move${actions.length === 1 ? "" : "s"} for a stronger week.`;

  return { score, grade: report.grade, headline, actions: actions.slice(0, 3), wins };
}
