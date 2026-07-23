import { callRpc } from "./rpc-client";

export type FeedScope = "global" | "following";

export const getFeed = (scope: FeedScope = "global") =>
  callRpc<any[]>("getFeed", { scope });

export const createPost = ({ data }: { data: { kind: "workout" | "pr" | "progress" | "text"; content?: string; image_url?: string | null; metadata?: Record<string, unknown> } }) =>
  callRpc<any>("createPost", data);

export const toggleLike = ({ data }: { data: { postId: string; reaction?: "fire" | "beast" | "respect" | "goat" } }) =>
  callRpc<{ liked: boolean; reaction: string | null }>("toggleLike", data);

export const addComment = ({ data }: { data: { postId: string; content: string } }) =>
  callRpc<{ ok: boolean }>("addComment", data);

export const getComments = ({ data }: { data: { postId: string } }) =>
  callRpc<any[]>("getComments", data);

export const getLeaderboard = (scope: FeedScope = "global") =>
  callRpc<{ top: any[]; me: any | null }>("getSocialLeaderboard", { scope });

export type NotifType = "follow" | "reaction" | "comment";
export interface AppNotification {
  type: NotifType;
  actor: { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  created_at: string;
  reaction?: string;
  postId?: string;
  snippet?: string;
}
export const getNotifications = () => callRpc<AppNotification[]>("getNotifications");

export type DuelMetric = "volume" | "sessions" | "prs";
export interface Duel {
  id: string;
  metric: DuelMetric;
  status: "pending" | "active" | "declined" | "cancelled" | "completed";
  role: "challenger" | "opponent";
  needsMyResponse: boolean;
  start_at: string | null;
  end_at: string | null;
  ended: boolean;
  myScore: number;
  theirScore: number;
  winner: "me" | "them" | "tie" | null;
  opponent: { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
}
export const createDuel = ({ data }: { data: { opponentId: string; metric?: DuelMetric } }) =>
  callRpc<{ id: string }>("createDuel", data);
export const respondDuel = ({ data }: { data: { duelId: string; action: "accept" | "decline" | "cancel" } }) =>
  callRpc<{ ok: boolean; status: string }>("respondDuel", data);
export const getDuels = () => callRpc<Duel[]>("getDuels");

export const toggleFollow = ({ data }: { data: { userId: string } }) =>
  callRpc<{ following: boolean }>("toggleFollow", data);

export const searchAthletes = ({ data }: { data: { q: string } }) =>
  callRpc<any[]>("searchAthletes", data);

export const getSuggestedAthletes = () =>
  callRpc<any[]>("getSuggestedAthletes");

export const getMyFollowStats = () =>
  callRpc<{ following: number; followers: number }>("getMyFollowStats");

export const getAthleteCard = ({ data }: { data: { userId: string } }) =>
  callRpc<any>("getAthleteCard", data);

export const getMyReferralInfo = () =>
  callRpc<{ code: string | null; count: number; proUntil: string | null }>("getMyReferralInfo");

export const redeemReferral = ({ data }: { data: { code: string } }) =>
  callRpc<{ ok: boolean }>("redeemReferral", data);

export const updateMyProfile = ({ data }: { data: { username?: string; display_name?: string; bio?: string } }) =>
  callRpc<{ ok: boolean }>("updateMyProfile", data);

export const updateMyLocation = ({ data }: { data: { city: string; region?: string | null; country: string } }) =>
  callRpc<{ ok: boolean }>("updateMyLocation", data);

export const getMyLocation = () =>
  callRpc<{ city: string | null; region: string | null; country: string | null }>("getMyLocation");

export const getNearbyAthletes = () =>
  callRpc<{ athletes: any[]; myCity: string | null; myCountry: string | null }>("getNearbyAthletes");
