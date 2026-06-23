import { callRpc } from "./rpc-client";

export const loadUserState = () =>
  callRpc<{ data: string | null }>("loadUserState");

export const saveUserState = ({ data }: { data: { data: string } }) =>
  callRpc<{ ok: boolean }>("saveUserState", data);
