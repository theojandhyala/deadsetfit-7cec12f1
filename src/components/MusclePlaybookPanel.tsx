import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { hapticSelection } from "@/lib/haptics";
import { buildMusclePlaybook } from "@/lib/muscle-playbook";
import type { GrowthGoal, GrowthTarget } from "@/lib/muscle-growth-recommendations";
import type { Experience } from "@/lib/types";

type PlaybookSection = "BUILD" | "TECHNIQUE" | "MISTAKES" | "RECOVERY";

const SECTIONS: ReadonlyArray<{
  id: PlaybookSection;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "BUILD", label: "Build", Icon: BookOpen },
  { id: "TECHNIQUE", label: "Technique", Icon: Gauge },
  { id: "MISTAKES", label: "Mistakes", Icon: AlertTriangle },
  { id: "RECOVERY", label: "Recovery", Icon: ShieldCheck },
];

export function MusclePlaybookPanel({
  target,
  goal,
  experience,
  currentWeeklySets,
  recoveryPct,
}: {
  target: GrowthTarget;
  goal: GrowthGoal;
  experience?: Experience | null;
  currentWeeklySets: number;
  recoveryPct: number;
}) {
  const [section, setSection] = useState<PlaybookSection>("BUILD");
  const playbook = useMemo(
    () =>
      buildMusclePlaybook({ target, goal, experience, currentWeeklySets, recoveryPct }),
    [currentWeeklySets, experience, goal, recoveryPct, target],
  );

  function chooseSection(next: PlaybookSection) {
    if (next === section) return;
    setSection(next);
    hapticSelection();
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_100%_0%,rgba(230,50,34,.16),transparent_38%),#111216]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-cap text-[8px] text-accent-red">MUSCLE PLAYBOOK</p>
            <h3 className="display mt-0.5 text-lg font-black uppercase text-grit">
              Know what makes {playbook.label} move
            </h3>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-grit-dim">
            No AI
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">{playbook.role}</p>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <PlaybookMetric label="STARTING SETS" value={`${playbook.weeklySets.min}–${playbook.weeklySets.max}`} />
          <PlaybookMetric label="FREQUENCY" value={playbook.frequency.replace(" exposures", "×")} />
          <PlaybookMetric label="REP FOCUS" value={playbook.repFocus.split(" · ")[0] ?? playbook.repFocus} />
        </div>

        <div className="mt-3 rounded-xl border border-accent-red/25 bg-accent-red/[0.07] p-3">
          <p className="label-cap flex items-center gap-1.5 text-[8px] text-accent-red">
            <Activity size={11} /> YOUR CURRENT CALL
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-relaxed text-grit">
            {playbook.sessionCall}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-y border-white/[0.08] bg-black/25 p-2" role="tablist" aria-label={`${playbook.label} playbook sections`}>
        {SECTIONS.map(({ id, label, Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`playbook-tab-${id.toLowerCase()}`}
              aria-selected={active}
              aria-controls="muscle-playbook-content"
              onClick={() => chooseSection(id)}
              className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-[8px] font-black uppercase tracking-[0.08em] ${
                active
                  ? "border-accent-red/60 bg-accent-red text-black"
                  : "border-white/[0.08] bg-white/[0.03] text-grit-dim"
              }`}
            >
              <Icon size={12} strokeWidth={2.4} /> {label}
            </button>
          );
        })}
      </div>

      <div
        id="muscle-playbook-content"
        role="tabpanel"
        aria-labelledby={`playbook-tab-${section.toLowerCase()}`}
        className="deadset-view-switch p-4"
        key={`${target}-${goal}-${section}`}
      >
        <PlaybookContent section={section} playbook={playbook} />
      </div>

      <p className="border-t border-white/[0.08] px-4 py-3 text-[8px] leading-relaxed text-grit-dim">
        {playbook.evidenceNote}
      </p>
    </section>
  );
}

function PlaybookMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-black/30 p-2 text-center">
      <p className="display truncate text-sm font-black uppercase text-grit">{value}</p>
      <p className="label-cap mt-1 text-[6px] text-grit-dim">{label}</p>
    </div>
  );
}

function PlaybookContent({
  section,
  playbook,
}: {
  section: PlaybookSection;
  playbook: ReturnType<typeof buildMusclePlaybook>;
}) {
  if (section === "BUILD") {
    return (
      <div>
        <PlaybookHeading title="Three priorities" />
        <NumberedList items={playbook.priorities} />
        <PlaybookHeading title="Movement roles to cover" className="mt-4" />
        <div className="mt-2 space-y-2">
          {playbook.movementRoles.map((role) => (
            <div key={role.label} className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
              <p className="label-cap text-[8px] text-grit">{role.label}</p>
              <p className="mt-1 text-[9px] leading-relaxed text-grit-dim">{role.purpose}</p>
            </div>
          ))}
        </div>
        <PlaybookHeading title="Progression rule" className="mt-4" />
        <p className="mt-2 text-[10px] leading-relaxed text-grit">{playbook.progressionRule}</p>
      </div>
    );
  }

  if (section === "TECHNIQUE") {
    return (
      <div>
        <PlaybookHeading title="Repeatable rep checklist" />
        <CheckList items={playbook.techniqueCues} tone="good" />
      </div>
    );
  }

  if (section === "MISTAKES") {
    return (
      <div>
        <PlaybookHeading title="What usually stalls progress" />
        <CheckList items={playbook.commonMistakes} tone="warning" />
      </div>
    );
  }

  return (
    <div>
      <PlaybookHeading title="Before the next hard exposure" />
      <CheckList items={playbook.recoveryChecks} tone="good" />
      <PlaybookHeading title="Then progress" className="mt-4" />
      <p className="mt-2 text-[10px] leading-relaxed text-grit">{playbook.progressionRule}</p>
    </div>
  );
}

function PlaybookHeading({ title, className = "" }: { title: string; className?: string }) {
  return <p className={`label-cap text-[8px] text-grit-dim ${className}`}>{title}</p>;
}

function NumberedList({ items }: { items: readonly string[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-2 text-[10px] leading-relaxed text-grit">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-red text-[8px] font-black text-black">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function CheckList({ items, tone }: { items: readonly string[]; tone: "good" | "warning" }) {
  const Icon = tone === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 rounded-xl border border-white/[0.07] bg-black/25 p-2.5 text-[10px] leading-relaxed text-grit">
          <Icon
            size={13}
            className={tone === "good" ? "mt-0.5 shrink-0 text-emerald-400" : "mt-0.5 shrink-0 text-amber-400"}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
