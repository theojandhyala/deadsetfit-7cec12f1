import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, X, UserPlus, MessageCircle } from "lucide-react";
import { getNotifications, type AppNotification } from "@/lib/social.functions";

const SEEN_KEY = "deadset_notifs_seen_at";
const REACTION_EMOJI: Record<string, string> = { fire: "🔥", beast: "💪", respect: "🙌", goat: "🐐" };

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || "0");
  } catch {
    return 0;
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const n = await getNotifications();
      setItems(n);
      const seen = readSeen();
      setUnread(n.filter((x) => new Date(x.created_at).getTime() > seen).length);
    } catch {
      setItems((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  function openSheet() {
    setOpen(true);
    load();
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setUnread(0);
  }

  return (
    <>
      <button onClick={openSheet} aria-label="Notifications" className="relative p-1.5 press">
        <Bell size={20} className="text-grit" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-red text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-sm h-full bg-grit-bg border-l border-grit overflow-y-auto"
            style={{ background: "#0a0a0a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 bg-[#0a0a0a] border-b border-grit px-4 py-3 flex items-center justify-between z-10">
              <p className="display font-extrabold uppercase text-grit text-lg">Activity</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="press">
                <X size={20} className="text-grit-dim" />
              </button>
            </header>

            {items === null ? (
              <p className="text-center text-grit-dim text-sm py-10">Loading…</p>
            ) : items.length === 0 ? (
              <div className="text-center text-grit-dim text-sm px-6 py-12">
                No activity yet. When people follow you, react or comment, it shows here.
              </div>
            ) : (
              <ul className="divide-y divide-[#1c1c1c]">
                {items.map((n, i) => {
                  const name = n.actor.display_name || n.actor.username || "Athlete";
                  return (
                    <li key={i}>
                      <Link
                        to="/athlete/$id"
                        params={{ id: n.actor.id }}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 press"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a1a1a] flex items-center justify-center shrink-0 border border-grit">
                          {n.actor.avatar_url ? (
                            <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : n.type === "follow" ? (
                            <UserPlus size={15} className="text-accent-red" />
                          ) : n.type === "comment" ? (
                            <MessageCircle size={15} className="text-accent-red" />
                          ) : (
                            <span className="text-sm">{REACTION_EMOJI[n.reaction || "fire"]}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-grit leading-snug">
                            <span className="font-bold">{name}</span>{" "}
                            {n.type === "follow"
                              ? "started following you"
                              : n.type === "reaction"
                                ? `reacted ${REACTION_EMOJI[n.reaction || "fire"]} to your post`
                                : `commented: "${n.snippet}"`}
                          </p>
                        </div>
                        <span className="text-[11px] text-grit-dim shrink-0">{timeAgo(n.created_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
