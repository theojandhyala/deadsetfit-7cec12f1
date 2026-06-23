import { callRpc } from "./rpc-client";

export type RunCoachInsight = {
  headline: string;
  verdict: string;
  tips: string[];
  nextWorkout: string;
};

export const getRunCoachTips = ({ data }: { data: { distanceKm: number; durationSec: number; avgPaceSecPerKm: number; bestKmPaceSecPerKm?: number; splits: number[]; elevGainM?: number; recentRunsKm?: number[] } }) =>
  callRpc<RunCoachInsight>("getRunCoachTips", data);
