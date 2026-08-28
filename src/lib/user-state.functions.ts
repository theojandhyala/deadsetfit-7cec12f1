import { callRpc } from "./rpc-client";

/**
 * `updatedAt` is the row version this client last saw. It goes back with the
 * next save so the server can refuse a write from a device that has fallen
 * behind — without it two devices are last-write-wins, and the slower one
 * silently erases the other's session.
 */
export const loadUserState = () =>
  callRpc<{ data: string | null; updatedAt?: string | null }>("loadUserState");

export const saveUserState = ({
  data,
}: {
  data: { data: string; baseUpdatedAt?: string | null };
}) =>
  callRpc<{ ok: boolean; conflict?: boolean; updatedAt?: string | null }>("saveUserState", data);
