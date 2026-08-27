/** Render harness only: mounts <MuscleDiagram> so it can be screenshotted. */
import { createRoot } from "react-dom/client";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { TIER_COLOR, GRADED_MUSCLES } from "@/lib/strength-grades";

const tiers = ["ADVANCED", "INTERMEDIATE", "ELITE", "NOVICE", "BEGINNER", "WORLD_CLASS"] as const;
const colors = Object.fromEntries(
  GRADED_MUSCLES.map((m, i) => [m, TIER_COLOR[tiers[i % tiers.length]]]),
);

export function mount(el: HTMLElement) {
  const root = document.createElement("div");
  root.style.cssText =
    "padding:24px;display:flex;flex-direction:column;gap:28px;color:#eee;font:12px system-ui";
  el.appendChild(root);
  createRoot(root).render(
    <>
      <div>
        <p>AT 232 — the size the strength screen asks for</p>
        <div style={{ display: "flex", gap: 20, background: "#17181b", padding: 12 }}>
          <MuscleDiagram view="front" gradeColors={colors} size={232} />
          <MuscleDiagram view="back" gradeColors={colors} size={232} />
        </div>
      </div>
      <div>
        <p>AT 700 — same paths, magnified, so shape faults are visible</p>
        <div style={{ display: "flex", gap: 20, background: "#17181b", padding: 12 }}>
          <MuscleDiagram view="front" gradeColors={colors} size={700} />
          <MuscleDiagram view="back" gradeColors={colors} size={700} />
        </div>
      </div>
    </>,
  );
}
