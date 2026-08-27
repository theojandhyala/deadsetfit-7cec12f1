import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/stop-guessing")({
  head: () => ({
    meta: [
      { title: "Stop guessing what to train | DEADSET" },
      { name: "description", content: "Tell DEADSET your goal and training days. Open the gym with a plan and clear set targets." },
    ],
  }),
  component: () => <Landing campaign="stop-guessing" />,
});
