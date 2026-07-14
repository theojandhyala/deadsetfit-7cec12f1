import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, Apple, User, Users, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getMyFollowStats } from "@/lib/social.functions";

const STORAGE_KEY = "deadset_last_seen_followers";

const LEFT_TABS = [
  { to: "/train", label: "Train", Icon: Dumbbell },
  { to: "/diet", label: "Diet", Icon: Apple },
] as const;

const RIGHT_TABS = [
  { to: "/friends", label: "Friends", Icon: Users },
  { to: "/profile", label: "You", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hasFriendsBadge, setHasFriendsBadge] = useState(false);
  const loadFollowStats = useCallback(() => getMyFollowStats(), []);

  useEffect(() => {
    let cancelled = false;
    loadFollowStats()
      .then(({ followers }) => {
        if (cancelled) return;
        const lastSeen = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
        if (followers > lastSeen) setHasFriendsBadge(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loadFollowStats]);

  useEffect(() => {
    if (!pathname.startsWith("/friends")) return;
    setHasFriendsBadge(false);
    loadFollowStats()
      .then(({ followers }) => localStorage.setItem(STORAGE_KEY, String(followers)))
      .catch(() => {});
  }, [loadFollowStats, pathname]);

  const isRecordActive = pathname.startsWith("/workout/live");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        // No backdrop-filter: fixed bars with backdrop blur intermittently
        // composite as solid BLACK while scrolling in WKWebView/iOS Safari.
        background: "linear-gradient(180deg, rgba(24,25,31,0.99), rgba(10,10,12,1))",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -22px 54px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex items-center h-[70px]">
        {/* Left tabs */}
        {LEFT_TABS.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1.5 h-[70px] relative press"
                style={{ color: active ? "#E10600" : "#6B7280" }}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#E10600" : "#6B7280" }}
                >
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-t-full"
                    style={{ background: "#E10600" }}
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
            className="flex flex-col items-center justify-center gap-1 press"
            aria-label="Start workout"
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: isRecordActive
                  ? "#d93e00"
                  : "linear-gradient(135deg, #E10600 0%, #E10600 100%)",
                boxShadow: "0 8px 28px rgba(225,6,0,0.34)",
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
          const showBadge = to === "/friends" && hasFriendsBadge;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1.5 h-[70px] relative press"
                style={{ color: active ? "#E10600" : "#6B7280" }}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {showBadge && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                      style={{ background: "#E10600" }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#E10600" : "#6B7280" }}
                >
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-t-full"
                    style={{ background: "#E10600" }}
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
