import { callRpc } from "./rpc-client";

export const analyzePhysique = ({ data }: { data: { imageDataUrl: string; goal: string; weightKg?: number } }) =>
  callRpc<{ bodyFatEstimate: number; muscleScore: number; symmetryScore: number; leanMassNote: string; strengths: string[]; weaknesses: string[]; focus: string[]; verdict: string }>("analyzePhysique", data);
