import { Link } from "@tanstack/react-router";
import { Camera, MessageSquare, Scan, Images } from "lucide-react";

const TOOLS = [
  {
    to: "/diet",
    label: "Meal Scan",
    desc: "Snap & log macros",
    Icon: Camera,
  },
  {
    to: "/coach",
    label: "AI Coach",
    desc: "Ask anything",
    Icon: MessageSquare,
  },
  {
    to: "/progress",
    label: "Physique Scan",
    desc: "BF · muscle · symmetry",
    Icon: Scan,
  },
  {
    to: "/progress",
    label: "Progress Pics",
    desc: "Track transformation",
    Icon: Images,
  },
] as const;

export function AIToolbox() {
  return (
    <section className="px-5 mb-5 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <h2 className="label-cap text-xs text-grit-dim">AI TOOLBOX</h2>
        <span
          className="label-cap text-[10px] px-1.5 py-0.5"
          style={{ background: "rgba(225,6,0,0.15)", color: "#E10600" }}
        >
          POWERED BY AI
        </span>
      </div>
      <div className="-mx-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 px-5 pb-1">
          {TOOLS.map(({ to, label, desc, Icon }) => (
            <Link
              key={label}
              to={to}
              className="press shrink-0 w-[140px] p-3 flex flex-col gap-2"
              style={{
                background: "rgba(20,20,20,0.85)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-9 h-9 flex items-center justify-center"
                style={{ background: "rgba(225,6,0,0.15)", color: "#E10600" }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="label-cap text-[12px] text-grit leading-tight">{label}</p>
                <p className="text-[10px] text-grit-dim mt-1 leading-tight">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
