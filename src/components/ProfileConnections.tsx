import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Check, Loader2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { getAthleteConnections, getMyFollowStats, setAthleteFollow } from "@/lib/social.functions";
import {
  followLabel,
  type AthleteConnection,
  type ConnectionDirection,
  type ConnectionPage,
} from "@/lib/social-connections";
import { hapticFailure, hapticSelection } from "@/lib/haptics";

export function ProfileConnections({
  userId,
  counts,
  own = false,
  onChange,
}: {
  userId: string;
  counts?: { followers: number; following: number };
  own?: boolean;
  onChange?: () => void;
}) {
  const [myCounts, setMyCounts] = useState<typeof counts>();
  const [countError, setCountError] = useState(false);
  const [direction, setDirection] = useState<ConnectionDirection | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const refresh = useCallback(() => {
    if (!own) return;
    setCountError(false);
    void getMyFollowStats()
      .then(setMyCounts)
      .catch(() => setCountError(true));
  }, [own]);
  useEffect(() => {
    refresh();
  }, [refresh, userId]);
  const totals = own ? myCounts : counts;
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#251312,#111214)]">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Users size={15} className="text-accent-red" />
        <h2 className="label-cap text-[10px] text-grit">
          {own ? "Your lifting circle" : "Lifting circle"}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {(["followers", "following"] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            onClick={(event) => {
              opener.current = event.currentTarget;
              hapticSelection();
              setDirection(kind);
            }}
            className="press min-h-16 rounded-xl border border-white/10 bg-black/25 p-3 text-left"
            aria-label={`View ${kind}`}
          >
            <span className="display block text-2xl font-black text-grit">
              {totals?.[kind]?.toLocaleString() ?? "—"}
            </span>
            <span className="mt-1 flex items-center justify-between text-[10px] font-bold capitalize text-grit-dim">
              {kind}
              <ArrowUpRight size={12} />
            </span>
          </button>
        ))}
      </div>
      {countError && (
        <button type="button" className="min-h-11 w-full text-xs text-grit-dim" onClick={refresh}>
          Counts unavailable · Retry
        </button>
      )}
      <p className="px-4 pb-4 text-[10px] leading-relaxed text-grit-dim">
        Follow to keep up with public posts. Follow each other to become friends and compare
        progress.
      </p>
      <Dialog.Root
        open={direction !== null}
        onOpenChange={(open) => {
          if (!open) setDirection(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
            }}
            className="fixed left-1/2 top-1/2 z-[101] flex max-h-[80dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111214] p-4 text-grit shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="display text-2xl font-black uppercase">
                {direction}
              </Dialog.Title>
              <Dialog.Close
                className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10"
                aria-label="Close connections"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-1 text-xs leading-relaxed text-grit-dim">
              Public connections. Blocked athletes are hidden.
            </Dialog.Description>
            {direction && (
              <ConnectionList
                key={`${userId}-${direction}`}
                userId={userId}
                direction={direction}
                onNavigate={() => setDirection(null)}
                onChange={() => {
                  refresh();
                  onChange?.();
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function ConnectionList({
  userId,
  direction,
  onNavigate,
  onChange,
}: {
  userId: string;
  direction: ConnectionDirection;
  onNavigate: () => void;
  onChange: () => void;
}) {
  const [page, setPage] = useState<ConnectionPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const alive = useRef(true);
  const loadingRef = useRef(false);
  const busyRef = useRef(false);
  const load = useCallback(
    async (offset = 0) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const next = await getAthleteConnections({ userId, direction, offset });
        if (alive.current)
          setPage((previous) => ({
            ...next,
            athletes: offset
              ? [
                  ...new Map(
                    [...(previous?.athletes ?? []), ...next.athletes].map((row) => [row.id, row]),
                  ).values(),
                ]
              : next.athletes,
          }));
      } catch (e) {
        if (alive.current) setError(e instanceof Error ? e.message : "Couldn't load connections");
      } finally {
        loadingRef.current = false;
        if (alive.current) setLoading(false);
      }
    },
    [userId, direction],
  );
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  async function follow(row: AthleteConnection) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(row.id);
    hapticSelection();
    try {
      const result = await setAthleteFollow({ userId: row.id, following: !row.following });
      if (!alive.current) return;
      setPage(
        (previous) =>
          previous && {
            ...previous,
            athletes: previous.athletes.map((item) =>
              item.id === row.id ? { ...item, following: result.following } : item,
            ),
          },
      );
      onChange();
      toast.success(result.following ? "Following athlete" : "Unfollowed");
    } catch (e) {
      if (alive.current) {
        hapticFailure();
        toast.error(e instanceof Error ? e.message : "Couldn't update follow");
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(null);
    }
  }
  return (
    <div className="no-scrollbar mt-4 min-h-0 overflow-y-auto overscroll-contain">
      <ul className="space-y-2">
        {page?.athletes.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-3">
              <Link
                to="/athlete/$id"
                params={{ id: row.id }}
                onClick={onNavigate}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
              >
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-red/15 font-black text-accent-red">
                    {(row.display_name || row.username || "A").slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block break-words text-sm font-bold">
                    {row.display_name || row.username || "Athlete"}
                  </span>
                  <span className="block break-words text-[10px] text-grit-dim">
                    {row.username ? `@${row.username}` : "DEADSET athlete"}
                    {row.following && row.followsMe
                      ? " · Friends"
                      : row.followsMe
                        ? " · Follows you"
                        : ""}
                  </span>
                </span>
              </Link>
              {!row.isMe && (
                <button
                  type="button"
                  disabled={busy !== null}
                  aria-label={`${followLabel(row.following, row.followsMe)} ${row.username || row.display_name || "athlete"}`}
                  onClick={() => void follow(row)}
                  className={`press grid min-h-11 min-w-11 place-items-center rounded-xl border ${row.following ? "border-white/15 text-grit" : "border-accent-red/40 bg-accent-red/15 text-accent-red"} disabled:opacity-50`}
                >
                  {busy === row.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : row.following ? (
                    <Check size={16} />
                  ) : (
                    <UserPlus size={16} />
                  )}
                </button>
              )}
            </div>
            {row.bio && (
              <p className="mt-2 line-clamp-2 break-words text-[11px] leading-relaxed text-grit-dim">
                {row.bio}
              </p>
            )}
          </li>
        ))}
      </ul>
      {page && !page.athletes.length && !loading && (
        <p className="py-6 text-center text-xs text-grit-dim">No visible connections here yet.</p>
      )}
      {loading && (
        <p
          role="status"
          className="flex min-h-14 items-center justify-center gap-2 text-xs text-grit-dim"
        >
          <Loader2 className="animate-spin" size={15} /> Loading connections…
        </p>
      )}
      {error && (
        <div role="alert" className="py-3 text-xs text-grit-dim">
          <p>{error}</p>
          <button
            type="button"
            className="btn-ghost mt-2 min-h-11 w-full"
            onClick={() => void load(page?.nextOffset ?? 0)}
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && page?.nextOffset != null && (
        <button
          type="button"
          className="btn-ghost mt-3 min-h-11 w-full text-xs"
          onClick={() => void load(page.nextOffset!)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
