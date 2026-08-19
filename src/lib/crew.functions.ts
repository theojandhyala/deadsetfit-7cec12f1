import { callRpc } from "./rpc-client";

export type Crew = {
  id: string;
  name: string;
  tag: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type CrewMember = {
  id: string;
  role: string;
  joinedAt: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  grit_points: number;
  level: string;
  weekVolumeKg: number;
  weekSessions: number;
  weekPRs: number;
};

export type CrewWeek = {
  weekStart: string;
  volumeKg: number;
  sessions: number;
  prs: number;
  /** Members who trained at least once this week. */
  active: number;
};

export type CrewLadderRow = {
  id: string;
  name: string;
  tag: string;
  members: number;
  totalGrit: number;
  avgGrit: number;
};

export const createCrew = ({ data }: { data: { name: string; tag: string } }) =>
  callRpc<{ crew: Crew }>("createCrew", data);

export const joinCrew = ({ data }: { data: { code: string } }) =>
  callRpc<{ crew: Crew }>("joinCrew", data);

export const leaveCrew = () => callRpc<{ left: boolean }>("leaveCrew");

export const getMyCrew = () =>
  callRpc<{ crew: Crew | null; role?: string; members: CrewMember[]; week?: CrewWeek }>(
    "getMyCrew",
  );

export const getCrewLadder = ({ data }: { data?: { limit?: number } } = {}) =>
  callRpc<{ crews: CrewLadderRow[] }>("getCrewLadder", data ?? {});
