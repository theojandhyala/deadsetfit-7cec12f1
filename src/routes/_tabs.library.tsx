import { createFileRoute } from "@tanstack/react-router";
import { ExerciseFinder } from "@/components/ExerciseFinder";

export const Route = createFileRoute("/_tabs/library")({
  head: () => ({ meta: [{ title: "DEADSET — Exercise Finder" }] }),
  component: ExerciseFinder,
});
