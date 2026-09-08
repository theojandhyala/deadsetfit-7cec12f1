import type { GrowthGoal, GrowthTarget } from "./muscle-growth-recommendations";
import { growthTargetOption } from "./muscle-growth-recommendations";
import type { Experience } from "./types";

export interface MusclePlaybook {
  target: GrowthTarget;
  label: string;
  role: string;
  weeklySets: { min: number; max: number };
  frequency: string;
  repFocus: string;
  sessionCall: string;
  priorities: readonly string[];
  movementRoles: readonly { label: string; purpose: string }[];
  techniqueCues: readonly string[];
  commonMistakes: readonly string[];
  recoveryChecks: readonly string[];
  progressionRule: string;
  evidenceNote: string;
}

type BroadTarget = "CHEST" | "BACK" | "SHOULDERS" | "ARMS" | "LEGS" | "CORE";

interface BroadPlaybook {
  role: string;
  baseSets: [number, number];
  frequency: string;
  movementRoles: readonly { label: string; purpose: string }[];
  techniqueCues: readonly string[];
  commonMistakes: readonly string[];
  recoveryChecks: readonly string[];
}

const BROAD_PLAYBOOKS: Record<BroadTarget, BroadPlaybook> = {
  CHEST: {
    role: "Pressing strength and upper-body mass through the pectorals, with the front delts and triceps supporting.",
    baseSets: [10, 16],
    frequency: "2–3 exposures / week",
    movementRoles: [
      { label: "Heavy press", purpose: "A stable press you can load and measure for months." },
      { label: "Angle press", purpose: "Bias the upper or lower fibres your current week misses." },
      { label: "Adduction", purpose: "A fly pattern that trains the pecs without triceps limiting the set." },
    ],
    techniqueCues: [
      "Set the shoulder blades before the first rep and keep the upper back planted.",
      "Lower under control to a repeatable touch point; press without bouncing.",
      "Let the elbows travel in a comfortable arc instead of forcing them fully flared.",
      "Use a pain-free range that keeps tension on the chest rather than the front shoulder.",
    ],
    commonMistakes: [
      "Adding load while the range of motion quietly gets shorter.",
      "Turning every chest set into a front-delt and triceps set.",
      "Using three similar presses but no movement that brings the arm across the body.",
    ],
    recoveryChecks: [
      "Pressing performance is back near normal.",
      "The pecs are not sharply sore in a stretched position.",
      "Shoulders feel stable through warm-up reps.",
    ],
  },
  BACK: {
    role: "Back width, thickness and trunk strength through vertical pulls, rows and hip-hinge support.",
    baseSets: [12, 18],
    frequency: "2–3 exposures / week",
    movementRoles: [
      { label: "Vertical pull", purpose: "Train shoulder extension and back width through the lats." },
      { label: "Horizontal row", purpose: "Build mid-back thickness and scapular control." },
      { label: "Hinge / extension", purpose: "Load the spinal erectors and posterior chain when appropriate." },
    ],
    techniqueCues: [
      "Start the pull by moving the shoulder blade, then drive the elbow.",
      "Keep the torso angle repeatable so added momentum does not fake progression.",
      "Reach into a controlled stretch without letting the shoulder collapse forward.",
      "Use straps when grip ends the back set long before the target muscles do.",
    ],
    commonMistakes: [
      "Counting heaved partial rows as load progress.",
      "Training only pulldowns or only rows and leaving half the back under-served.",
      "Letting biceps fatigue decide when every back set ends.",
    ],
    recoveryChecks: [
      "Grip and elbow flexors no longer limit warm-ups.",
      "The lower back can brace without lingering fatigue.",
      "Pulling performance is stable before adding more weekly work.",
    ],
  },
  SHOULDERS: {
    role: "Shoulder width and pressing control across the front, side and rear delts.",
    baseSets: [10, 18],
    frequency: "2–4 exposures / week",
    movementRoles: [
      { label: "Overhead press", purpose: "Build measurable pressing strength and front-delt capacity." },
      { label: "Lateral raise", purpose: "Give the side delts direct work for visible width." },
      { label: "Rear-delt pull", purpose: "Balance pressing volume and train the back of the shoulder." },
    ],
    techniqueCues: [
      "Move the upper arm in the shoulder blade's natural plane rather than forcing a rigid line.",
      "Lead raises with the elbows and stop before the traps take over the rep.",
      "Keep ribs stacked during overhead work instead of turning it into an incline press.",
      "Use controlled lighter reps for raises; load is useful only while the delt owns the motion.",
    ],
    commonMistakes: [
      "Assuming chest pressing fully covers side and rear delts.",
      "Shrugging every lateral raise as fatigue rises.",
      "Chasing heavy overhead numbers through excessive back extension.",
    ],
    recoveryChecks: [
      "You can raise the arm overhead without pinching or compensation.",
      "Press warm-ups feel stable and symmetrical.",
      "Direct delt soreness has settled before repeating hard isolation work.",
    ],
  },
  ARMS: {
    role: "Elbow-flexion, elbow-extension and grip strength through biceps, triceps and forearms.",
    baseSets: [8, 16],
    frequency: "2–4 exposures / week",
    movementRoles: [
      { label: "Lengthened curl", purpose: "Challenge elbow flexors where the biceps starts stretched." },
      { label: "Triceps extension", purpose: "Train elbow extension, including an overhead long-head option." },
      { label: "Neutral / grip", purpose: "Build brachialis and forearm capacity with neutral-grip work." },
    ],
    techniqueCues: [
      "Keep the upper arm quiet so the elbow flexors or extensors move the load.",
      "Use a complete comfortable elbow range and control the change of direction.",
      "Match wrist position to the implement instead of bending it under load.",
      "Count indirect pressing and pulling before adding large amounts of arm isolation.",
    ],
    commonMistakes: [
      "Adding direct sets without counting hard presses and pulls.",
      "Swinging curls or shortening pushdowns just to keep the same weight.",
      "Changing exercise and technique too often to measure real progression.",
    ],
    recoveryChecks: [
      "Elbows and wrists feel normal in warm-ups.",
      "Grip is not still depressed from the last pull session.",
      "Full-range reps return before adding load or sets.",
    ],
  },
  LEGS: {
    role: "Lower-body strength and size across knee extension, hip extension, knee flexion and the calves.",
    baseSets: [12, 20],
    frequency: "2–3 exposures / week",
    movementRoles: [
      { label: "Squat pattern", purpose: "Load knee and hip extension through a stable, repeatable depth." },
      { label: "Hinge / curl", purpose: "Train hamstrings through hip extension and knee flexion." },
      { label: "Single-leg / calf", purpose: "Cover side-to-side control and the lower leg directly." },
    ],
    techniqueCues: [
      "Use the deepest pain-free range you can repeat without losing trunk position.",
      "Track knee and foot direction together rather than forcing one universal stance.",
      "Brace before descending and keep pressure through the whole foot.",
      "Separate squat, hinge and curl work so one pattern does not pretend to train everything.",
    ],
    commonMistakes: [
      "Adding plates while depth and control disappear.",
      "Using only squat patterns and leaving knee-flexion hamstring work out.",
      "Doing all demanding leg work in one session and calling the rest of the week recovery.",
    ],
    recoveryChecks: [
      "Normal walking and stairs are comfortable again.",
      "Warm-up speed and depth have returned.",
      "Knees, hips and lower back feel stable—not merely less sore.",
    ],
  },
  CORE: {
    role: "Bracing, trunk flexion, rotation control and force transfer between the upper and lower body.",
    baseSets: [6, 14],
    frequency: "2–4 exposures / week",
    movementRoles: [
      { label: "Loaded flexion", purpose: "Progress the abs through measurable resistance and range." },
      { label: "Anti-extension", purpose: "Resist the lower back arching under a longer lever." },
      { label: "Anti-rotation", purpose: "Control unwanted twisting and train the obliques." },
    ],
    techniqueCues: [
      "Exhale and bring the ribs toward the pelvis before the hard part of the rep.",
      "Keep the pelvis controlled rather than borrowing motion from the lower back.",
      "Progress leverage or load only while the trunk position stays unchanged.",
      "For carries and holds, finish the set when position breaks—not when the clock looks impressive.",
    ],
    commonMistakes: [
      "Only doing untracked high-rep circuits with no progressive overload.",
      "Feeling every leg raise mainly in the hip flexors.",
      "Holding the breath without learning to brace and breathe under tension.",
    ],
    recoveryChecks: [
      "Bracing does not limit the next compound session.",
      "The lower back is not compensating during warm-ups.",
      "You can reproduce the same trunk position before increasing leverage.",
    ],
  },
};

const FOCUS_PRIORITY: Record<GrowthTarget, readonly string[]> = {
  CHEST: ["Keep one measurable press", "Cover at least two pressing angles", "Add controlled adduction work"],
  BACK: ["Pair a vertical pull with a row", "Make torso position repeatable", "Keep hinge fatigue separate when needed"],
  SHOULDERS: ["Give side delts direct work", "Balance presses with rear-delt work", "Keep every raise controlled"],
  ARMS: ["Count indirect pressing and pulling", "Train flexion and extension", "Keep elbows and wrists comfortable"],
  LEGS: ["Cover squat, hinge and knee flexion", "Use repeatable depth", "Distribute hard sets across the week"],
  CORE: ["Train more than one trunk function", "Progress load or leverage", "Stop sets when position breaks"],
  UPPER_CHEST: ["Use an incline you can stabilise", "Drive the upper arm up and across", "Keep front-delt fatigue honest"],
  MID_CHEST: ["Keep a repeatable flat press", "Use full comfortable horizontal adduction", "Progress reps before load"],
  LOWER_CHEST: ["Choose a decline press or stable dip", "Keep shoulders depressed and controlled", "Avoid turning dips into triceps-only work"],
  BACK_WIDTH: ["Lead vertical pulls with the elbows", "Use a full controlled overhead reach", "Keep the torso from turning every pull into a row"],
  BACK_THICKNESS: ["Anchor one chest-supported or strict row", "Pause without shrugging", "Progress while torso angle stays fixed"],
  LOWER_BACK: ["Build bracing before loading", "Use hip motion rather than lumbar motion", "Manage overlap with squats and deadlifts"],
  TRAPS: ["Use controlled elevation and depression", "Keep neck position neutral", "Count heavy carries and pulls"],
  FRONT_DELTS: ["Prioritise a stable overhead press", "Stack ribs over pelvis", "Count chest-press contribution"],
  SIDE_DELTS: ["Lead with elbows", "Use cable or dumbbell tension you can control", "Repeat short high-quality exposures"],
  REAR_DELTS: ["Move the upper arm behind the torso", "Keep traps from dominating", "Pair direct work with rows"],
  BICEPS: ["Include a lengthened curl", "Keep the upper arm still", "Use supinated and neutral grips across the week"],
  TRICEPS: ["Include overhead elbow extension", "Keep elbows tracking comfortably", "Count hard pressing volume"],
  FOREARMS: ["Use neutral-grip curls or carries", "Progress grip time or load", "Keep wrist position controlled"],
  QUADS: ["Use deep knee flexion you can own", "Keep a stable squat or press", "Add knee-extension work if compounds miss it"],
  HAMSTRINGS: ["Pair a hinge with a leg curl", "Keep the spine braced", "Control the stretched position"],
  GLUTES: ["Train hip extension through full range", "Use a squat or split stance too", "Lock out with glutes—not the lower back"],
  CALVES: ["Use a full bottom stretch", "Pause at the top", "Train straight- and bent-knee positions when possible"],
  ADDUCTORS: ["Use controlled deep squat or sumo patterns", "Build range gradually", "Keep the foot and knee aligned"],
  ABDUCTORS: ["Control the pelvis during single-leg work", "Use direct abduction without swinging", "Progress range before resistance"],
  HIP_FLEXORS: ["Lift the thigh without lumbar compensation", "Use controlled hanging or supported work", "Balance strength with comfortable hip extension"],
  ABS: ["Create rib-to-pelvis movement", "Load flexion or anti-extension progressively", "Keep hip flexors from owning every rep"],
  OBLIQUES: ["Train anti-rotation and lateral stability", "Keep hips and ribs stacked", "Progress carries, presses or controlled rotation"],
};

const EXPERIENCE_SCALE: Record<Experience, [number, number]> = {
  BEGINNER: [0.7, 0.75],
  INTERMEDIATE: [1, 1],
  ADVANCED: [1.1, 1.2],
};

function repFocus(goal: GrowthGoal): string {
  if (goal === "STRENGTH") return "3–8 on anchors · 6–12 assistance";
  if (goal === "BALANCE") return "6–15 controlled reps";
  return "6–12 compounds · 10–20 isolation";
}

function progressionRule(goal: GrowthGoal): string {
  if (goal === "STRENGTH") {
    return "Keep the setup and range fixed. When every working set reaches its rep target with 1–3 reps in reserve, add the smallest sensible load next time.";
  }
  if (goal === "BALANCE") {
    return "Keep the weaker area first in the session. Add reps inside the target range before adding load, and stop adding sets once weekly coverage is balanced.";
  }
  return "Use double progression: add clean reps until every set reaches the top of its range, then add the smallest load and return to the lower end.";
}

function sessionCall(sets: number, min: number, max: number, recoveryPct: number): string {
  if (recoveryPct < 45) return "Recovery is low. Keep the next exposure easier or wait until performance returns.";
  if (sets < min) return `You are ${min - sets} hard set${min - sets === 1 ? "" : "s"} below the starting range. Add work gradually, not all at once.`;
  if (sets > max) return `You are ${sets - max} hard set${sets - max === 1 ? "" : "s"} above the starting range. Hold or reduce before adding more.`;
  return "Your weekly hard-set count is inside the starting range. Progress execution, reps or load before adding volume.";
}

export function buildMusclePlaybook({
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
}): MusclePlaybook {
  const option = growthTargetOption(target);
  const broad = BROAD_PLAYBOOKS[option.muscleGroup];
  const [minScale, maxScale] = EXPERIENCE_SCALE[experience ?? "BEGINNER"];
  const min = Math.max(4, Math.round(broad.baseSets[0] * minScale));
  const max = Math.max(min + 2, Math.round(broad.baseSets[1] * maxScale));
  const safeSets = Math.max(0, Math.round(Number.isFinite(currentWeeklySets) ? currentWeeklySets : 0));
  const safeRecovery = Math.max(0, Math.min(100, Number.isFinite(recoveryPct) ? recoveryPct : 100));

  return {
    target,
    label: option.label,
    role: broad.role,
    weeklySets: { min, max },
    frequency: broad.frequency,
    repFocus: repFocus(goal),
    sessionCall: sessionCall(safeSets, min, max, safeRecovery),
    priorities: FOCUS_PRIORITY[target],
    movementRoles: broad.movementRoles,
    techniqueCues: broad.techniqueCues,
    commonMistakes: broad.commonMistakes,
    recoveryChecks: broad.recoveryChecks,
    progressionRule: progressionRule(goal),
    evidenceNote:
      "This is a conservative starting framework, not a medical prescription. Hard sets mean controlled working sets taken reasonably close to failure; adjust to performance, soreness and joint comfort.",
  };
}
