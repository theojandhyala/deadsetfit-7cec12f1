import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Users, ArrowUpRight } from "lucide-react";
import {
  getNearbyAthletes,
  getMutualFriends,
  type MutualFriendPreview,
} from "@/lib/social.functions";

export function ProfileDiscovery({ locationKey }: { locationKey: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getNearbyAthletes>> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(false);
    void getNearbyAthletes()
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [locationKey, attempt]);
  return (
    <section className="rounded-2xl border border-white/10 bg-grit-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-grit">
          <MapPin size={15} className="text-accent-red" /> Your local lifting circle
        </h2>
        <Link
          to="/friends"
          search={{ section: "FRIENDS" }}
          aria-label="Find more friends"
          className="icon-btn shrink-0"
        >
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {error ? (
        <button className="min-h-11 text-xs text-grit-dim" onClick={() => setAttempt((n) => n + 1)}>
          Couldn't load nearby athletes · Retry
        </button>
      ) : !result ? (
        <p role="status" className="py-3 text-xs text-grit-dim">
          Finding athletes…
        </p>
      ) : !result.myCity ? (
        <div className="mt-2 text-xs leading-relaxed text-grit-dim">
          <p>
            Add your city in profile details to discover local athletes. Your city is public; we
            don't show precise locations.
          </p>
          <a
            href="#profile-details"
            className="mt-2 inline-flex min-h-11 items-center font-bold text-accent-red"
          >
            Set up my city →
          </a>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] text-grit-dim">
            Athletes sharing {result.myCity}. City-based, not live location.
          </p>
          {result.athletes.length ? (
            <div className="grid grid-cols-2 gap-2">
              {result.athletes.slice(0, 4).map((athlete) => (
                <Link
                  key={athlete.id}
                  to="/athlete/$id"
                  params={{ id: athlete.id }}
                  className="press min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 text-center"
                >
                  <SmallAvatar athlete={athlete} />
                  <p className="mt-2 truncate text-xs font-bold text-grit">
                    {athlete.display_name || athlete.username || "Athlete"}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-grit-dim">
                    {athlete.following ? "Following" : "View profile →"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-grit-dim">
              No athletes nearby yet. Invite a gym friend to start your circle.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function MutualFriends({ userId }: { userId: string }) {
  const [athletes, setAthletes] = useState<MutualFriendPreview[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setAthletes([]);
    setError(false);
    void getMutualFriends(userId)
      .then((value) => {
        if (active) setAthletes(value.athletes);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  if (error)
    return (
      <button className="min-h-11 text-xs text-grit-dim" onClick={() => setAttempt((n) => n + 1)}>
        Mutual friends unavailable · Retry
      </button>
    );
  if (!athletes.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 p-3">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-grit">
        <Users size={14} className="text-accent-red" /> Friends you both know
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {athletes.map((athlete) => (
          <Link
            key={athlete.id}
            to="/athlete/$id"
            params={{ id: athlete.id }}
            className="press flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-white/5 p-2"
          >
            <span className="min-w-0 truncate text-xs font-semibold text-grit">
              {athlete.display_name || athlete.username || "Athlete"}
            </span>
            <ArrowUpRight size={12} className="ml-auto shrink-0 text-grit-dim" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function SmallAvatar({ athlete }: { athlete: MutualFriendPreview }) {
  const [failed, setFailed] = useState(false);
  const name = athlete.display_name || athlete.username || "DS";
  return (
    <div className="mx-auto grid size-12 place-items-center overflow-hidden rounded-full border border-accent-red/30 bg-[#27272a] text-sm font-black text-grit">
      {athlete.avatar_url && !failed ? (
        <img
          src={athlete.avatar_url}
          onError={() => setFailed(true)}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
