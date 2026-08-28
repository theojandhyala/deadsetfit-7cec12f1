/** Normalize the syntax people naturally type into the athlete finder.
 *
 * Usernames may contain underscores, so they must not be stripped. Percent is
 * removed because it is the multi-character wildcard in Postgres ILIKE. The
 * API uses the typed `.ilike(column, pattern)` filter instead of interpolating
 * this value into a raw PostgREST `.or(...)` expression.
 */
export function normalizeAthleteSearchQuery(raw: string): string {
  const visible = raw
    .trim()
    .replace(/^@+\s*/, "")
    .replace(/%/g, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return visible.replace(/\s+/g, " ").trim().slice(0, 40);
}

export function athleteSearchRank(
  athlete: { username?: string | null; display_name?: string | null },
  query: string,
): number {
  const needle = query.toLocaleLowerCase();
  const username = athlete.username?.toLocaleLowerCase() ?? "";
  const displayName = athlete.display_name?.toLocaleLowerCase() ?? "";
  if (username === needle) return 0;
  if (username.startsWith(needle)) return 1;
  if (displayName === needle) return 2;
  if (displayName.startsWith(needle)) return 3;
  if (username.includes(needle)) return 4;
  if (displayName.includes(needle)) return 5;
  return 6;
}
