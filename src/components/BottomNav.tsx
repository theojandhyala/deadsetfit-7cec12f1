import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, Activity, Apple, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyFollowStats } from "@/lib/social.functions";

const STORAGE_KEY = "deadset_last_seen_followers";

const tabs = [
  { to: "/train", label: "Train", Icon: Dumbbell },
  { to: "/run", label: "Cardio", Icon: Activity },
  { to: "/friends", label: "Friends", Icon: Users },
  { to: "/diet", label: "Diet", Icon: Apple },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hasFriendsBadge, setHasFriendsBadge] = useState(false);
  const _getStats = useServerFn(getMyFollowStats);

  useEffect(() => {
    let cancelled = false;
    _getStats()
      .then(({ followers }) => {
        if (cancelled) return;
        const lastSeen = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
        if (followers > lastSeen) {
          setHasFriendsBadge(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Clear badge when visiting friends tab
  useEffect(() => {
    if (pathname.startsWith("/friends")) {
      setHasFriendsBadge(false);
      _getStats()
        .then(({ followers }) => {
          localStorage.setItem(STORAGE_KEY, String(followers));
        })
        .catch(() => {});
    }
  }, [pathname]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-grit"
      style={{ background: "#0a0a0a", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          const showBadge = to === "/friends" && hasFriendsBadge;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1 py-3 relative"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={2.5} />
                  {showBadge && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 bg-accent-red rounded-full"
                      style={{ background: "#e63222" }}
                    />
                  )}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
