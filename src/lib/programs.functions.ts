import { callRpc } from "./rpc-client";

export const smartSuggest = ({ data }: { data: { goal: string; experience: string; days: Array<{ label: string; items: Array<{ name: string; primary_muscles: string[] }> }>; candidates: Array<{ id: string; name: string; primary_muscles: string[] }> } }) =>
  callRpc<{ gaps: Array<{ day: string; muscle: string; reason: string; suggested_ids: string[] }> }>("smartSuggest", data);
