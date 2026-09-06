/**
 * Invite codes skip I, O, 0 and 1: a code read out across a gym floor should
 * never be ambiguous.
 */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = random(INVITE_CODE_LENGTH);
  let out = "";
  for (const b of bytes) out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  return out;
}

export interface CrewSeed {
  id: string;
  name: string;
  tag: string;
}

export interface RankedCrew extends CrewSeed {
  members: number;
  totalGrit: number;
  avgGrit: number;
}

/**
 * Rank crews for the ladder.
 *
 * Average grit leads so a five-strong gym can beat a fifty-strong one on
 * quality rather than headcount; total breaks ties, so between two equally
 * strong crews the bigger one edges it. Empty crews never appear.
 */
export function rankCrews(
  crews: CrewSeed[],
  membersByCrew: Map<string, string[]>,
  gritById: Map<string, number>,
  limit = 25,
): RankedCrew[] {
  return crews
    .map((c) => {
      const ids = membersByCrew.get(c.id) ?? [];
      const totalGrit = ids.reduce((sum, id) => sum + (gritById.get(id) ?? 0), 0);
      return {
        ...c,
        members: ids.length,
        totalGrit,
        avgGrit: ids.length ? Math.round(totalGrit / ids.length) : 0,
      };
    })
    .filter((c) => c.members > 0)
    .sort((a, b) => b.avgGrit - a.avgGrit || b.totalGrit - a.totalGrit)
    .slice(0, limit);
}
