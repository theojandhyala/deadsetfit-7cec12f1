import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, CalendarDays, User, BicepsFlexed, Plus } from "lucide-react";

import { hapticSelection } from "@/lib/haptics";

const LEFT_TABS = [
  { to: "/train", label: "Train", Icon: Dumbbell },
  { to: "/plan", label: "Plan", Icon: CalendarDays },
] as const;

const RIGHT_TABS = [
  { to: "/strength", label: "Strength", Icon: BicepsFlexed },
  { to: "/profile", label: "You", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isRecordActive = pathname.startsWith("/workout/live");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-2"
      style={{
        // No backdrop-filter: fixed bars with backdrop blur intermittently
        // composite as solid BLACK while scrolling in WKWebView/iOS Safari.
        background: "linear-gradient(180deg, rgba(24,25,31,0.99), rgba(10,10,12,1))",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -22px 54px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex h-[70px] items-center">
        {/* Left tabs */}
        {LEFT_TABS.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                onClick={hapticSelection}
                className="relative flex h-[70px] flex-col items-center justify-center gap-1.5 press"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#e63222" : "#8a8a8a" }}
                >
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-t-full"
                    style={{ background: "#e63222" }}
                  />
                )}
              </Link>
            </li>
          );
        })}

        {/* Center Record button */}
        <li className="flex-shrink-0 px-2">
          <Link
            to="/workout/live"
            search={{}}
            onClick={hapticSelection}
            className="flex flex-col items-center justify-center gap-1 press"
            aria-label="Start workout"
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: isRecordActive
                  ? "#b92318"
                  : "linear-gradient(145deg, #f04434 0%, #d5261a 100%)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow:
                  "0 10px 30px rgba(230,50,34,0.36), 0 0 0 5px rgba(7,7,8,0.92), inset 0 1px 0 rgba(255,255,255,0.24)",
                transform: isRecordActive ? "translateY(-4px) scale(1.04)" : "translateY(-9px)",
                transition: "box-shadow 0.2s ease, transform 0.15s ease",
              }}
            >
              <Plus size={26} color="#fff" strokeWidth={2.5} />
            </div>
          </Link>
        </li>

        {/* Right tabs */}
        {RIGHT_TABS.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                onClick={hapticSelection}
                className="relative flex h-[70px] flex-col items-center justify-center gap-1.5 press"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#e63222" : "#8a8a8a" }}
                >
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-t-full"
                    style={{ background: "#e63222" }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
