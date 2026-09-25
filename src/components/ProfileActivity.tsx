import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Grid2X2, Trophy, X, Loader2, Flag } from "lucide-react";
import { toast } from "sonner";
import { getAthleteActivity } from "@/lib/social.functions";
import {
  activitySummary,
  safeActivityImage,
  type ActivityPage,
  type ActivityPost,
} from "@/lib/profile-activity";
import { reportContent } from "@/lib/account.functions";
import { askText } from "@/lib/confirm";
import { hapticSelection, hapticFailure } from "@/lib/haptics";

export function ProfileActivity({ userId, own = false }: { userId: string; own?: boolean }) {
  // Key by athlete so in-flight responses can never carry into another profile.
  return <ActivityGallery key={userId} userId={userId} own={own} />;
}

function ActivityGallery({ userId, own }: { userId: string; own: boolean }) {
  const [page, setPage] = useState<ActivityPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ActivityPost | null>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const load = useCallback(
    async (before?: NonNullable<ActivityPage["next"]>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError(false);
      try {
        const result = await getAthleteActivity({ userId, before });
        if (alive.current)
          setPage((previous) => ({
            ...result,
            posts: before
              ? [
                  ...new Map(
                    [...(previous?.posts ?? []), ...result.posts].map((post) => [post.id, post]),
                  ).values(),
                ]
              : result.posts,
          }));
      } catch {
        if (alive.current) setError(true);
      } finally {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [userId],
  );
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  async function report(post: ActivityPost) {
    setSelected(null);
    const reason = await askText({
      title: "Report post",
      message: "Tell us what's wrong with this post.",
      placeholder: "Reason for reporting",
    });
    if (!reason?.trim()) return;
    try {
      await reportContent({
        data: { postId: post.id, userId: post.user_id, reason: reason.trim() },
      });
      toast.success("Report sent for review");
    } catch {
      hapticFailure();
      toast.error("Couldn't send report. Please try again.");
    }
  }

  return (
    <section className="mx-5 mb-5 min-w-0" aria-label="Shared activity">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-grit">
          <Grid2X2 size={16} className="text-accent-red" /> Shared activity
        </h2>
        {own && (
          <Link
            to="/friends"
            search={{ section: "FEED" }}
            className="press flex min-h-11 items-center text-xs font-bold text-accent-red"
          >
            Share an update →
          </Link>
        )}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-grit-dim">
        Shared moments, not private workout history. PR posts are self-reported.
      </p>
      {!page && busy && (
        <p role="status" className="py-5 text-center text-xs text-grit-dim">
          Loading shared activity…
        </p>
      )}
      {page?.posts.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-grit-dim">
          {own
            ? "Your story starts here. Share a lift or update from the Feed."
            : "No shared moments yet."}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(expanded ? page?.posts : page?.posts.slice(0, 4))?.map((post) => {
          const summary = activitySummary(post);
          return (
            <button
              key={post.id}
              type="button"
              aria-label={`Open ${summary.label}: ${summary.title}`}
              onClick={(event) => {
                opener.current = event.currentTarget;
                hapticSelection();
                setSelected(post);
              }}
              className="press relative flex min-h-44 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#291412,#111214)] text-left"
            >
              <ActivityImage url={post.image_url} />
              <div className="relative z-10 flex flex-1 flex-col justify-end bg-gradient-to-t from-black/95 to-black/20 p-3">
                <span className="mb-2 text-[9px] font-black uppercase tracking-widest text-accent-red">
                  {summary.label}
                </span>
                <p className="display break-words text-xl font-black uppercase leading-tight text-grit">
                  {summary.title}
                </p>
                {summary.detail ? (
                  <p className="mt-1 text-sm font-bold text-grit">{summary.detail}</p>
                ) : (
                  <p className="mt-1 line-clamp-2 break-words text-xs text-grit">
                    {post.content || "Tap to view"}
                  </p>
                )}
                <time className="mt-3 text-[10px] text-grit-dim">{postDate(post.created_at)}</time>
              </div>
            </button>
          );
        })}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-grit-dim"
        >
          Couldn't load activity.{" "}
          <button
            className="min-h-11 font-bold text-grit"
            disabled={busy}
            onClick={() => void load(page?.next ?? undefined)}
          >
            Try again
          </button>
        </div>
      )}
      {!expanded && (page?.posts.length ?? 0) > 4 && (
        <button
          className="btn-ghost mt-3 min-h-11 w-full text-xs"
          onClick={() => {
            hapticSelection();
            setExpanded(true);
          }}
        >
          View more moments
        </button>
      )}
      {expanded && page?.next && !error && (
        <button
          disabled={busy}
          className="btn-ghost mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-xs"
          onClick={() => void load(page.next ?? undefined)}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}Load older activity
        </button>
      )}
      <Dialog.Root
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/85" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
            }}
            className="fixed left-1/2 top-1/2 z-[101] max-h-[80dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/15 bg-[#111214] p-5 text-grit"
          >
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="display min-w-0 break-words text-2xl font-black uppercase">
                {selected ? activitySummary(selected).title : "Shared activity"}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close activity"
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-xs text-grit-dim">
              {selected
                ? `${activitySummary(selected).label} · ${postDate(selected.created_at)}`
                : "Shared post details"}
            </Dialog.Description>
            {selected && (
              <>
                {activitySummary(selected).detail && (
                  <p className="display my-4 flex items-center gap-2 text-3xl font-black">
                    <Trophy size={20} className="text-accent-red" />
                    {activitySummary(selected).detail}
                  </p>
                )}
                <ActivityImage key={selected.id} url={selected.image_url} full />
                <p className="my-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {selected.content}
                </p>
                {!own && (
                  <button
                    onClick={() => void report(selected)}
                    className="btn-ghost flex min-h-11 w-full items-center justify-center gap-2 text-xs"
                  >
                    <Flag size={14} />
                    Report post
                  </button>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function ActivityImage({ url, full = false }: { url: string | null; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = safeActivityImage(url);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={full ? "Photo shared by this athlete" : ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={
        full
          ? "mt-4 max-h-[45dvh] w-full rounded-xl object-contain"
          : "absolute inset-0 size-full object-cover"
      }
    />
  );
}
function postDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "Date unavailable";
}
