import { callRpc } from "./rpc-client";

export const lookupBarcode = ({ data }: { data: { barcode: string } }) =>
  callRpc<{ name: string; calories: number; protein: number; carbs: number; fats: number; serving: string }>("lookupBarcode", data);
