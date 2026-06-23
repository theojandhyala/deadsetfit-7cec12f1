import { callRpc } from "./rpc-client";

export const scorePump = ({ data }: { data: { label: string; totalVolume: number; prCount: number; sets: number; durationMin: number; exercises: Array<{ name: string; sets: number; topWeight: number; topReps: number }> } }) =>
  callRpc<{ score: number; note: string }>("scorePump", data);
