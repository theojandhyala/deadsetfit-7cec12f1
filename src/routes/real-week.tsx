import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/real-week")({
  head: () => ({
    meta: [
      { title: "A workout plan that fits your week | DEADSET" },
      { name: "description", content: "Choose the days you can train. DEADSET builds a balanced training week around your real schedule." },
    ],
  }),
  component: () => <Landing campaign="real-week" />,
});
