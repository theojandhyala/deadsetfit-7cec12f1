import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/workout-tracker")({
  head: () => ({
    meta: [
      { title: "Workout Tracker for Sets, PRs and Progress | DEADSET" },
      { name: "description", content: "Track sets, see your previous performance and make progressive overload easier with Deadset." },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/workout-tracker" }],
  }),
  component: () => <Landing campaign="stop-guessing" />,
});
