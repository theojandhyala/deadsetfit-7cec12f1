import { callRpc } from "./rpc-client";

export type LeaderboardCategory = "RANK" | "OVERALL" | "TOTAL" | "BENCH" | "SQUAT" | "DEADLIFT" | "STREAK";
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
