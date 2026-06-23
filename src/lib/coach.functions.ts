import { callRpc } from "./rpc-client";

export const coachChat = ({ data }: { data: { messages: Array<{ role: "user" | "assistant"; content: string }>; context?: { goal?: string; experience?: string; weightKg?: number; heightCm?: number; benchKg?: number; squatKg?: number; deadliftKg?: number; streak?: number } } }) =>
  callRpc<{ reply: string }>("coachChat", data);
