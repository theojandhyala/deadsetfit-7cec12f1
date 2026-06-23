import { callRpc } from "./rpc-client";

export const deleteMyAccount = () =>
  callRpc<{ ok: boolean }>("deleteMyAccount");

export const blockUser = ({ data }: { data: { userId: string } }) =>
  callRpc<{ blocked: boolean }>("blockUser", data);

export const unblockUser = ({ data }: { data: { userId: string } }) =>
  callRpc<{ blocked: boolean }>("unblockUser", data);

export const isBlocked = ({ data }: { data: { userId: string } }) =>
  callRpc<{ blocked: boolean }>("isBlocked", data);

export const reportContent = ({ data }: { data: { userId?: string; postId?: string; reason: string } }) =>
  callRpc<{ ok: boolean }>("reportContent", data);
