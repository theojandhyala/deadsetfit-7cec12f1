export type PRGroup = "PUSH" | "PULL" | "LEGS" | "CORE" | "OTHER";

export function groupForMuscle(muscleGroup: string | undefined, exerciseId: string): PRGroup {
  if (/curl/i.test(exerciseId)) return "PULL";
  if (/skull|tricep|pushdown/i.test(exerciseId)) return "PUSH";
  switch ((muscleGroup || "").toUpperCase()) {
    case "CHEST":
    case "SHOULDERS":
      return "PUSH";
    case "BACK":
      return "PULL";
    case "LEGS":
      return "LEGS";
    case "CORE":
      return "CORE";
    case "ARMS":
      return "PUSH";
    default:
      return "OTHER";
  }
}
