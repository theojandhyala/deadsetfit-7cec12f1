import { callRpc } from "./rpc-client";

export const loadUserState = () => callRpc<{ data: string | null }>("loadUserState");

export const saveUserState = ({ data }: { data: { data: string } }) =>
  // Every save carries the device's tz offset so the server derives streaks
  // and weekly stats on the athlete's calendar day, not UTC's.
  callRpc<{ ok: boolean }>("saveUserState", {
    ...data,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  });
