import { callRpc } from "./rpc-client";

export type LeaderboardCategory =
  | "WEEKLY"
  | "RANK"
  | "OVERALL"
  | "TOTAL"
  | "P4P"
  | "BENCH"
  | "SQUAT"
  | "DEADLIFT"
  | "VOLUME"
  | "PRS"
  | "STREAK";
export type LeaderboardRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: string | null;
  value: number;
  unit: string;
  rank_label?: string;
};

export const getLeaderboard = ({
  data,
}: {
  data: { category: LeaderboardCategory; limit?: number };
}) => callRpc<{ rows: LeaderboardRow[] }>("getLeaderboard", data);
