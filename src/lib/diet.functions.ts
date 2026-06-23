import { callRpc } from "./rpc-client";

export const analyzeFoodPhoto = ({ data }: { data: { imageDataUrl: string } }) =>
  callRpc<{ name: string; calories: number; protein: number; carbs: number; fats: number; confidence: string; notes: string }>("analyzeFoodPhoto", data);

export const lookupBarcode = ({ data }: { data: { barcode: string } }) =>
  callRpc<{ name: string; calories: number; protein: number; carbs: number; fats: number; serving: string }>("lookupBarcode", data);

export const weeklyNutritionReport = ({ data }: { data: { goal: string; targetCalories: number; targetProtein: number; days: Array<{ date: string; calories: number; protein: number; carbs: number; fats: number; waterMl: number }> } }) =>
  callRpc<{ grade: string; adherence: number; avgCalories: number; avgProtein: number; hydrationScore: number; wins: string[]; misses: string[]; action: string }>("weeklyNutritionReport", data);
