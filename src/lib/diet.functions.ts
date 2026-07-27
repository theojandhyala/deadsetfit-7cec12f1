import { callRpc } from "./rpc-client";

export const lookupBarcode = ({ data }: { data: { barcode: string } }) =>
  callRpc<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    serving: string;
  }>("lookupBarcode", data);

export type FoodSearchResult = {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export const searchFoods = (query: string) =>
  callRpc<{ foods: FoodSearchResult[] }>("searchFoods", { query });
