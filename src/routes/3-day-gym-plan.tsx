import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/3-day-gym-plan")({
  head: () => ({
    meta: [
      { title: "3 Day Gym Plan That Fits Your Week | DEADSET" },
      {
        name: "description",
        content:
          "Build a simple three-day gym plan around your goal, equipment and available days with Deadset.",
      },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/3-day-gym-plan" }],
  }),
  component: () => <Landing campaign="real-week" />,
});
