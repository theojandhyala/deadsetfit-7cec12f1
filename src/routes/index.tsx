import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DEADSET — Train Smarter. Track Everything. Forge Your Body." },
      {
        name: "description",
        content:
          "DEADSET is the all-in-one fitness app built to help you plan workouts, track progress, and stay motivated to reach your goals.",
      },
      { property: "og:title", content: "DEADSET — Forge Your Body" },
      {
        property: "og:description",
        content: "Track PRs, follow programs, log workouts. Train. Build. Become.",
      },
      { property: "og:url", content: "https://deadsetfit.org/" },
      {
        property: "og:image",
        content:
          "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png",
      },
      {
        name: "twitter:image",
        content:
          "https://deadsetfit.org/__l5e/assets-v1/784b292b-3adf-4fa7-9f14-d45495738304/deadset-logo.png",
      },
      { name: "twitter:title", content: "DEADSET — Forge Your Body" },
      {
        name: "twitter:description",
        content: "Track PRs, follow programs, log workouts. Train. Build. Become.",
      },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/" }],
  }),
  component: Landing,
});
