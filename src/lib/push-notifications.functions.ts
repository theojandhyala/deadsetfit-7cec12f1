import { callRpc } from "./rpc-client";
export const registerPushToken = (token: string, rivalAlertsEnabled: boolean) =>
  callRpc<{ ok: boolean }>("registerPushToken", { token, rivalAlertsEnabled });

export const updatePushPreference = (rivalAlertsEnabled: boolean) =>
  callRpc<{ ok: boolean }>("updatePushPreference", { rivalAlertsEnabled });

export const unregisterPushTokens = () => callRpc<{ ok: boolean }>("unregisterPushTokens");

export const notifyRivalWorkout = (sessionId: string) =>
  callRpc<{ delivered: number; suppressed: number }>("notifyRivalWorkout", { sessionId });
