/**
 * Logical backup of the DEADSET Supabase project.
 *
 * Supabase's Free plan takes no automated backups, and PITR is a paid add-on on
 * top of Pro — so without this, 18 people's training history has no safety net
 * whatsoever. A dropped table or a bad migration would be unrecoverable.
 *
 * Writes one gzipped JSON file containing auth users (ids, emails, metadata,
 * identity providers — no password hashes) plus every public table. Small data,
 * so a full snapshot each run beats incremental complexity.
 *
 * Password hashes are deliberately excluded: they are not exportable through the
 * admin API, and a backup file that could authenticate as any user is a bigger
 * liability than the inconvenience of password resets in a disaster. Accounts
 * and all training data are recoverable; passwords would need resetting.
 *
 * Usage:
 *   bun scripts/backup-supabase.ts            → ./backups/deadset-<date>.json.gz
 *   BACKUP_DIR=/elsewhere bun scripts/backup-supabase.ts
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (bun
 * loads .env automatically).
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputDir = process.env.BACKUP_DIR ?? "backups";

if (!url || !serviceKey) {
  console.error("\nSet SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n");
  process.exit(1);
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

/** Discovered from PostgREST rather than hardcoded: a hand-maintained list goes
 *  stale the first time a migration adds a table, and a backup that silently
 *  skips a table is worse than no backup, because it inspires false confidence.
 *  Views come along too — redundant but harmless, and noted in the snapshot. */
async function discoverTables(): Promise<string[]> {
  const response = await fetch(`${url}/rest/v1/`, { headers });
  if (!response.ok) throw new Error(`schema discovery failed: HTTP ${response.status}`);
  const spec = (await response.json()) as {
    definitions?: Record<string, unknown>;
    components?: { schemas?: Record<string, unknown> };
  };
  const names = Object.keys(spec.definitions ?? spec.components?.schemas ?? {});
  if (names.length === 0) throw new Error("schema discovery returned no tables");
  return names.sort();
}

async function fetchTable(table: string): Promise<{ rows: unknown[]; note?: string }> {
  const response = await fetch(`${url}/rest/v1/${table}?select=*`, { headers });
  if (response.status === 404) return { rows: [], note: "table not present" };
  if (!response.ok) return { rows: [], note: `HTTP ${response.status}` };
  return { rows: (await response.json()) as unknown[] };
}

async function fetchAuthUsers() {
  const users: unknown[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers,
    });
    if (!response.ok) throw new Error(`admin users page ${page}: HTTP ${response.status}`);
    const body = (await response.json()) as { users: any[] };
    if (body.users.length === 0) break;
    users.push(
      ...body.users.map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        providers: (user.identities ?? []).map((identity: any) => identity.provider),
      })),
    );
    if (body.users.length < 200) break;
  }
  return users;
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const snapshot: Record<string, unknown> = {
  taken_at: new Date().toISOString(),
  project: new URL(url).hostname,
  note: "auth users exclude password hashes — accounts restore, passwords need reset",
};

const authUsers = await fetchAuthUsers();
snapshot.auth_users = authUsers;
console.log(`\nauth_users        ${authUsers.length}`);

const tables = await discoverTables();
snapshot.tables_discovered = tables;

const notes: string[] = [];
for (const table of tables) {
  const { rows, note } = await fetchTable(table);
  snapshot[table] = rows;
  console.log(`${table.padEnd(22)} ${rows.length}${note ? `  (${note})` : ""}`);
  if (note) notes.push(`${table}: ${note}`);
}

mkdirSync(outputDir, { recursive: true });
const file = join(outputDir, `deadset-${stamp}.json.gz`);
const payload = gzipSync(Buffer.from(JSON.stringify(snapshot)));
writeFileSync(file, payload);

console.log(`\nWrote ${file} (${(payload.length / 1024).toFixed(0)} kB gzipped)`);
if (notes.length > 0) console.log(`Notes: ${notes.join(", ")}`);
console.log(
  `\nRestore is a manual operation — read the file, then replay auth users through\n` +
    `/auth/v1/admin/users and each table through /rest/v1. Test it before you need it.\n`,
);
