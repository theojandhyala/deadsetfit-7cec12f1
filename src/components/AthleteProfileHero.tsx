import { useState, type ReactNode } from "react";
import { Camera, MapPin } from "lucide-react";

/** One identity across your own profile and the profile other athletes see. */
export function AthleteProfileHero({
  name,
  username,
  avatarUrl,
  bio,
  location,
  rank,
  connections,
  actions,
  onChangePhoto,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string;
  rank: string;
  connections?: ReactNode;
  actions?: ReactNode;
  onChangePhoto?: () => void;
}) {
  return (
    <section className="min-w-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(230,50,34,0.16),transparent_65%)] px-5 pb-5 pt-3 text-center">
      <div className="relative mx-auto w-fit">
        <AthleteAvatar key={avatarUrl} name={name} url={avatarUrl} />
        {onChangePhoto && (
          <button
            type="button"
            onClick={onChangePhoto}
            aria-label="Change profile photo"
            className="press absolute -bottom-1 -right-2 grid size-11 place-items-center rounded-full border-4 border-[#0b0b0d] bg-accent-red text-white"
          >
            <Camera size={17} />
          </button>
        )}
      </div>
      <h1 className="display mt-4 break-words text-3xl font-black uppercase leading-tight text-grit">
        {name}
      </h1>
      {username && (
        <p className="mt-1 break-all text-sm font-semibold text-grit-dim">@{username}</p>
      )}
      <p className="mx-auto mt-2 w-fit rounded-full border border-accent-red/25 bg-accent-red/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-red">
        {rank}
      </p>
      {connections}
      {bio && (
        <p className="mx-auto mt-3 max-w-sm whitespace-pre-wrap break-words text-sm leading-relaxed text-grit">
          {bio}
        </p>
      )}
      {location && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-grit-dim">
          <MapPin size={12} className="shrink-0" />
          <span className="min-w-0 break-words">{location}</span>
        </p>
      )}
      {actions && <div className="mt-4">{actions}</div>}
    </section>
  );
}

function AthleteAvatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid size-24 place-items-center overflow-hidden rounded-full border-2 border-accent-red/70 bg-[#1e1e22] shadow-[0_0_28px_rgba(230,50,34,0.15)]">
      {url && !failed ? (
        <img
          src={url}
          onError={() => setFailed(true)}
          alt={`${name}'s profile`}
          width={96}
          height={96}
          className="size-full object-cover"
        />
      ) : (
        <span className="display text-4xl font-black text-grit" aria-label={`${name}'s profile`}>
          {name.trim().slice(0, 2).toUpperCase() || "DS"}
        </span>
      )}
    </div>
  );
}
