import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./privacy";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "DEADSET — Health Disclaimer" },
      { name: "description", content: "Important safety information for using DEADSET." },
      { property: "og:title", content: "DEADSET — Health Disclaimer" },
      { property: "og:description", content: "Important safety information for using DEADSET." },
      { property: "og:url", content: "https://deadsetfit.org/disclaimer" },
      { name: "twitter:title", content: "DEADSET — Health Disclaimer" },
      { name: "twitter:description", content: "Important safety information for using DEADSET." },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/disclaimer" }],
  }),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <LegalShell title="Health Disclaimer" updated="June 3, 2026">
      <p>
        DEADSET provides fitness information, programs, and tracking. It is <b>not</b> a substitute
        for professional medical advice, diagnosis, or treatment.
      </p>

      <H>Consult a professional</H>
      <p>
        Talk to a qualified physician before starting any exercise program, especially if you have a
        medical condition, are pregnant, are recovering from injury, or are under 18. Stop
        immediately and seek medical attention if you feel dizzy, faint, short of breath, or
        experience chest pain.
      </p>

      <H>Assumption of risk</H>
      <p>
        Strength training carries inherent risk. You voluntarily assume all risk of injury,
        including from exercises you choose, weights you load, and form you use.
      </p>

      <H>Not medical, nutritional or coaching advice</H>
      <p>
        PR estimates, macro suggestions, program recommendations, and the technique and form cues
        shown alongside exercises in DEADSET are general information only. They do not constitute
        medical, nutritional, psychological, or licensed-coaching advice, and they cannot account
        for your body, your injury history, or what is happening in front of you. If a movement
        hurts, stop, and get eyes on it from a qualified coach.
      </p>

      <H>Limitation of liability</H>
      <p>
        To the maximum extent permitted by law, DEADSET and its operators are not liable for any
        injury, loss, or damages resulting from your use of the app.
      </p>
    </LegalShell>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display text-lg font-extrabold uppercase text-grit mt-6 mb-1">{children}</h2>
  );
}
