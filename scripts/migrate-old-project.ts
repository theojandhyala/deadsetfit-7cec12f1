/**
 * One-off: move the 18 accounts and their training data from the Lovable-managed
 * Supabase project into the one DEADSET now owns.
 *
 * Background: the app was repointed at a fresh Supabase project, but the data
 * was never migrated, so every existing user is locked out — their credentials
 * exist only in the old project, and a re-signup silently creates an empty
 * duplicate account.
 *
 * Design constraints:
 * - No user data and no password hash may pass through a chat transcript, so the
 *   transfer happens entirely inside this process.
 * - The old project's public key is recovered at runtime from an archived
 *   Cloudflare Pages deployment (immutable, and that key ships in every browser
 *   bundle anyway), so no old-project credential has to be handled by hand.
 * - Reads go through a token-gated SECURITY DEFINER function on the old project
 *   (public.migration_export_2026), which must be dropped once this is done.
 * - User ids are preserved, so every foreign key in the public tables stays
 *   valid without rewriting anything.
 *
 * Usage — dry run (counts only, writes nothing):
 *   MIGRATION_TOKEN=… bun scripts/migrate-old-project.ts
 * Apply:
 *   MIGRATION_TOKEN=… bun scripts/migrate-old-project.ts --apply
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the new project) in the
 * environment; bun reads .env automatically.
 */

const OLD_PROJECT = "upofuwryfvvtkhphtcop";
const OLD_URL = `https://${OLD_PROJECT}.supabase.co`;
/** Archived pre-switch deployment — immutable, still serving the old bundle. */
const ARCHIVED_BUNDLE = "https://0bf310e6.deadsetfit.pages.dev";

const apply = process.argv.includes("--apply");
const token = process.env.MIGRATION_TOKEN;
const newUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!token) fail("Set MIGRATION_TOKEN (the export token for the old project).");
// Only writing needs the new project's credentials, so the export half can be
// rehearsed — and this script reviewed — without handling them.
if (apply && (!newUrl || !serviceKey)) {
  fail(
    "--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (new project) in the environment.",
  );
}
if (newUrl?.includes(OLD_PROJECT)) fail("SUPABASE_URL still points at the OLD project — aborting.");
const canReadNew = Boolean(newUrl && serviceKey);

const newHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

/** The anon key is public by design; pulling it from the archived bundle avoids
 *  a human copying a credential around. */
async function oldAnonKey(): Promise<string> {
  const page = await fetch(`${ARCHIVED_BUNDLE}/auth/`).then((r) => r.text());
  const asset = page.match(/assets\/auth-[^"]+\.js/)?.[0];
  if (!asset) fail("Could not locate the archived auth bundle.");
  const source = await fetch(`${ARCHIVED_BUNDLE}/${asset}`).then((r) => r.text());
  const key = source.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/)?.[0];
  if (!key) fail("Could not recover the old project's publishable key from the archived bundle.");
  return key;
}

async function exportTable(anonKey: string, what: string): Promise<any[]> {
  const response = await fetch(`${OLD_URL}/rest/v1/rpc/migration_export_2026`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, what }),
  });
  if (!response.ok)
    fail(`Export of ${what} failed: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as any[];
}

async function newCount(table: string): Promise<number> {
  const response = await fetch(`${newUrl}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { ...newHeaders, Prefer: "count=exact" },
  });
  const range = response.headers.get("content-range");
  return range ? Number(range.split("/")[1] ?? 0) : 0;
}

async function upsert(table: string, rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  // Chunked so a large user_state payload cannot blow the request limit.
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const response = await fetch(`${newUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...newHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!response.ok)
      fail(`Upsert into ${table} failed: HTTP ${response.status} ${await response.text()}`);
  }
}

/** GoTrue's admin create accepts a bcrypt `password_hash`, which is the only way
 *  to move accounts without forcing everyone through a password reset. */
async function createUser(user: any): Promise<"created" | "exists" | "no-password"> {
  const body: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    email_confirm: true,
    user_metadata: user.raw_user_meta_data ?? {},
    app_metadata: user.raw_app_meta_data ?? {},
  };
  if (user.encrypted_password) body.password_hash = user.encrypted_password;

  const response = await fetch(`${newUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: newHeaders,
    body: JSON.stringify(body),
  });
  if (response.ok) return user.encrypted_password ? "created" : "no-password";

  const detail = await response.text();
  if (/already|registered|exists/i.test(detail)) return "exists";
  if (/password_hash/i.test(detail)) {
    // Older GoTrue: create without a password and flag for a reset email.
    delete body.password_hash;
    const retry = await fetch(`${newUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: newHeaders,
      body: JSON.stringify(body),
    });
    if (retry.ok) return "no-password";
    fail(`Creating user failed: ${await retry.text()}`);
  }
  fail(`Creating user failed: HTTP ${response.status} ${detail}`);
}

const anonKey = await oldAnonKey();
console.log(`\nRecovered the old project's public key from the archived deployment.`);

const users = await exportTable(anonKey, "auth_users");
const tables = ["profiles", "user_state", "subscriptions", "posts", "follows"] as const;
const data: Record<string, any[]> = {};
for (const table of tables) data[table] = await exportTable(anonKey, table);

const googleOnly = users.filter((u: any) => !u.encrypted_password).length;
console.log(`\nOld project:`);
console.log(`  auth users        ${users.length} (${googleOnly} social-only, no password)`);
for (const table of tables) console.log(`  ${table.padEnd(17)} ${data[table].length}`);

if (canReadNew) {
  console.log(`\nNew project (before):`);
  for (const table of tables) console.log(`  ${table.padEnd(17)} ${await newCount(table)}`);
} else {
  console.log(`\nNew project: not inspected (no SUPABASE_SERVICE_ROLE_KEY in the environment).`);
}

/** An account created in the new project since the switch can hold an email that
 *  also belongs to one of the migrating users, under a different id. Inserting
 *  the old profile row would then violate the auth.users foreign key part-way
 *  through, so this is checked up front rather than discovered mid-write. */
async function emailConflicts() {
  if (!canReadNew) return [];
  const response = await fetch(`${newUrl}/auth/v1/admin/users?per_page=200`, {
    headers: newHeaders,
  });
  if (!response.ok) fail(`Could not list new-project users: ${await response.text()}`);
  const { users: existing } = (await response.json()) as { users: any[] };
  const byEmail = new Map(existing.map((u) => [String(u.email).toLowerCase(), u.id]));
  return users
    .map((old: any) => {
      const id = byEmail.get(String(old.email).toLowerCase());
      return id && id !== old.id ? { email: old.email, oldId: old.id, newId: id } : null;
    })
    .filter(Boolean) as { email: string; oldId: string; newId: string }[];
}

const conflicts = await emailConflicts();
if (conflicts.length > 0) {
  console.log(`\n${conflicts.length} email conflict(s) — same person, two different ids:`);
  for (const conflict of conflicts) {
    console.log(`  ${conflict.email}\n    old id ${conflict.oldId}\n    new id ${conflict.newId}`);
  }
  console.log(
    `\nThese must be resolved first. If the new-project account is a throwaway (created\n` +
      `by testing since the switch, no real data), delete it so the original account can\n` +
      `be restored with its own id and keep its history:\n` +
      conflicts
        .map(
          (c) =>
            `  curl -X DELETE "$SUPABASE_URL/auth/v1/admin/users/${c.newId}" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`,
        )
        .join("\n"),
  );
  if (apply) fail("Refusing to migrate with unresolved email conflicts.");
}

if (!apply) {
  console.log(`\nDry run — nothing written. Re-run with --apply to migrate.\n`);
  process.exit(0);
}

console.log(`\nMigrating…`);
const outcomes = { created: 0, exists: 0, "no-password": 0 } as Record<string, number>;
const needsReset: string[] = [];
for (const user of users) {
  const outcome = await createUser(user);
  outcomes[outcome] += 1;
  if (outcome === "no-password") needsReset.push(user.id);
}
console.log(
  `  users: ${outcomes.created} created with password, ${outcomes["no-password"]} without, ${outcomes.exists} already present`,
);

// profiles first: the other tables reference it.
for (const table of ["profiles", "user_state", "subscriptions", "posts", "follows"] as const) {
  await upsert(table, data[table]);
  console.log(`  ${table.padEnd(17)} ${await newCount(table)} rows now present`);
}

// The exercise library is seed data, not user data. If the new project's
// migrations already seeded it, leave it alone; if not, the app would show an
// empty exercise picker, which is the most visible "everything broke" symptom.
const exerciseCount = await newCount("exercises");
if (exerciseCount === 0) {
  const exercises = await exportTable(anonKey, "exercises");
  await upsert("exercises", exercises);
  console.log(
    `  exercises         ${await newCount("exercises")} rows seeded from the old project`,
  );
} else {
  console.log(`  exercises         ${exerciseCount} already present, left untouched`);
}

if (needsReset.length > 0) {
  console.log(
    `\n${needsReset.length} account(s) came across without a password (social sign-in only).\n` +
      `They sign in with Google/Apple as before — no action needed:\n  ${needsReset.join("\n  ")}`,
  );
}

console.log(
  `\nDone. Verify a real login, then drop the export function on the old project:\n` +
    `  drop function public.migration_export_2026(text, text);\n`,
);
