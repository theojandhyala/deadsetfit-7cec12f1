import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, LineChart, Apple, User, Users } from "lucide-react";

const tabs = [
  { to: "/train", label: "Train", Icon: Dumbbell },
  { to: "/progress", label: "Progress", Icon: LineChart },
  { to: "/friends", label: "Friends", Icon: Users },
  { to: "/diet", label: "Diet", Icon: Apple },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-grit"
      style={{ background: "#0a0a0a", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1 py-3"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                <Icon size={20} strokeWidth={2.5} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
