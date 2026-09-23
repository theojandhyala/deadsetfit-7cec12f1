import { Check } from "lucide-react";
import {
  onboardingChapter,
  SETUP_CHAPTERS,
  type OnboardingActiveStep,
} from "@/lib/onboarding-flow";

/** Static chapter positions: progress moves without shifting the screen. */
export function SetupJourney({ step }: { step: OnboardingActiveStep }) {
  const active = onboardingChapter(step);
  return (
    <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Setup chapters">
      {SETUP_CHAPTERS.map((label, index) => (
        <li
          key={label}
          aria-current={index === active ? "step" : undefined}
          className={`flex min-w-0 items-center gap-1.5 text-[9px] font-black tracking-wide transition-colors motion-reduce:transition-none ${index <= active ? "text-grit" : "text-grit-dim"}`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors motion-reduce:transition-none ${index <= active ? "border-accent-red/50 bg-accent-red/15 text-accent-red" : "border-white/10"}`}
          >
            {index < active ? <Check size={11} aria-hidden="true" /> : index + 1}
          </span>
          {label}
          {index < active && <span className="sr-only">complete</span>}
        </li>
      ))}
    </ol>
  );
}
