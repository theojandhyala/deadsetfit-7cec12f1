import { callRpc } from "./rpc-client";

export type LeaderboardCategory = "OVERALL" | "BENCH" | "SQUAT" | "DEADLIFT" | "TOTAL";
export type LeaderboardRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: string | null;
  value: number;
  unit: string;
};

export const getLeaderboard = ({ data }: { data: { category: LeaderboardCategory; limit?: number } }) =>
  callRpc<{ rows: LeaderboardRow[] }>("getLeaderboard", data);
