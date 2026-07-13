import { callRpc } from "./rpc-client";

export const saveProfile = ({ data }: { data: { username?: string; display_name?: string; goal?: string; experience?: string; gender?: string; age?: number; weight_kg?: number; height_cm?: number; days_per_week?: number; equipment?: string; bio?: string; avatar_url?: string; onboarded?: boolean; public_stats?: unknown; grit_points?: number } }) =>
  callRpc<{ ok: boolean }>("saveProfile", data);

export const getMyProfile = () =>
  callRpc<Record<string, unknown> | null>("getMyProfile");

export const signInWithUsername = ({ data }: { data: { username: string; password: string } }) =>
  callRpc<{ ok: false; error: string } | { ok: true; access_token: string; refresh_token: string }>("signInWithUsername", data);
