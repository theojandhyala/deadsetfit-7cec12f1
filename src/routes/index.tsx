import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — Forge Your Body | Gym & PR Tracker" },
      {
        name: "description",
        content:
          "DEADSET is a no-nonsense gym companion. Track bench, squat, deadlift PRs, follow programs, earn Grit, and forge your physique with your squad.",
      },
      { property: "og:title", content: "DEADSET — Forge Your Body" },
      { property: "og:description", content: "Track PRs, follow programs, log workouts. Train. Build. Become." },
      { property: "og:url", content: "https://deadsetfit.org/" },
      { property: "og:image", content: "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png" },
      { name: "twitter:image", content: "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png" },
      { name: "twitter:title", content: "DEADSET — Forge Your Body" },
      { name: "twitter:description", content: "Track PRs, follow programs, log workouts. Train. Build. Become." },
    ],
    links: [
      { rel: "canonical", href: "https://deadsetfit.org/" },
    ],
  }),
  component: Index,
});

function Index() {
  return <AuthPage />;
}
