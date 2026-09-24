import { z } from "zod";

export const connectionQuery = z.object({
  userId: z.string().uuid(),
  direction: z.enum(["followers", "following"]),
  offset: z.number().int().min(0).max(100_000).default(0),
});
export const followCommand = z.object({ userId: z.string().uuid(), following: z.boolean() });

export type ConnectionDirection = "followers" | "following";
export interface AthleteConnection {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  following: boolean;
  followsMe: boolean;
  isMe: boolean;
}
export interface ConnectionPage {
  athletes: AthleteConnection[];
  nextOffset: number | null;
}

/** Keep server relationship order and never reintroduce a blocked profile via a join. */
export function connectionPageRows(
  ids: string[],
  profiles: Pick<AthleteConnection, "id" | "username" | "display_name" | "avatar_url" | "bio">[],
  viewerId: string,
  hidden: Set<string>,
  following: Set<string>,
  followers: Set<string>,
): AthleteConnection[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return [...new Set(ids)].flatMap((id) => {
    const profile = byId.get(id);
    return !profile || hidden.has(id)
      ? []
      : [
          {
            ...profile,
            following: following.has(id),
            followsMe: followers.has(id),
            isMe: id === viewerId,
          },
        ];
  });
}

export function followLabel(following: boolean, followsMe: boolean) {
  return following ? "Following" : followsMe ? "Follow back" : "Follow";
}
