import { callRpc } from "./rpc-client";

export const generateSchedule = ({ data }: { data: { goal: string; experience: string; daysPerWeek: number; equipment: string } }) =>
  callRpc<{ days: Record<string, { label: string; exerciseIds: string[] }> }>("generateSchedule", data);

export const generateMeals = ({ data }: { data: { goal: string; calories: number; protein: number; carbs: number; fats: number; dislikes?: string } }) =>
  callRpc<{ breakfast: { name: string; calories: number; protein: number; carbs: number; fats: number }; lunch: { name: string; calories: number; protein: number; carbs: number; fats: number }; dinner: { name: string; calories: number; protein: number; carbs: number; fats: number }; snack: { name: string; calories: number; protein: number; carbs: number; fats: number } }>("generateMeals", data);

export const swapMeal = ({ data }: { data: { name: string; calories: number; protein: number; carbs: number; fats: number } }) =>
  callRpc<{ name: string; calories: number; protein: number; carbs: number; fats: number }>("swapMeal", data);
