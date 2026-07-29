/**
 * Reconciles Stripe subscriptions into Supabase entitlements.
 *
 * Why this exists: the worker's SUPABASE_SERVICE_ROLE_KEY was invalid until
 * 2026-07-29, and that key is the only thing behind the Stripe webhook's writes
 * to `subscriptions` and `profiles.pro_until`. Every webhook in that window
 * failed with "Invalid API key" — Stripe took the money, DEADSET never recorded
 * the entitlement. This replays the current truth from Stripe.
 *
 * It reuses src/lib/entitlements.ts, the same mapping the webhook applies, so an
 * audit can never grant or revoke Pro on rules that differ from production.
 *
 * Usage (dry run — reports, changes nothing):
 *   STRIPE_LIVE_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     bun scripts/reconcile-entitlements.ts
 *
 * Add --apply to write. Add --env=sandbox to audit test-mode subscriptions.
 */
import {
  subscriptionPayload,
  subscriptionStillUnlocksPro,
  type StripeEnv,
  type SubscriptionRow,
} from "../src/lib/entitlements";

const apply = process.argv.includes("--apply");
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const stripeEnv: StripeEnv = envArg?.endsWith("sandbox") ? "sandbox" : "live";

const stripeKey =
  stripeEnv === "live"
    ? process.env.STRIPE_LIVE_API_KEY
    : (process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_LIVE_API_KEY);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!stripeKey) fail("Set STRIPE_LIVE_API_KEY (or STRIPE_SANDBOX_API_KEY with --env=sandbox).");
if (!supabaseUrl || !serviceRoleKey) fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const supabaseHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function stripeGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${stripeKey}` } });
  if (!response.ok) fail(`Stripe ${path} failed: HTTP ${response.status} ${await response.text()}`);
  return response.json() as Promise<{ data: any[]; has_more: boolean }>;
}

/** Every subscription Stripe knows about, including cancelled ones — a
 *  cancellation still decides whether Pro should be on until the period ends. */
async function allStripeSubscriptions() {
  const subscriptions: any[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripeGet("subscriptions", {
      status: "all",
      limit: "100",
      "expand[]": "data.items.data.price",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
  } while (startingAfter);
  return subscriptions;
}

async function existingRows() {
  const url = `${supabaseUrl}/rest/v1/subscriptions?select=stripe_subscription_id,status,current_period_end,user_id&environment=eq.${stripeEnv}`;
  const response = await fetch(url, { headers: supabaseHeaders });
  if (!response.ok) fail(`Supabase read failed: HTTP ${response.status} ${await response.text()}`);
  const rows = (await response.json()) as {
    stripe_subscription_id: string;
    status: string;
    current_period_end: string | null;
    user_id: string | null;
  }[];
  return new Map(rows.map((row) => [row.stripe_subscription_id, row]));
}

async function profileProUntil(userId: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=pro_until&id=eq.${userId}`, {
    headers: supabaseHeaders,
  });
  if (!response.ok) return undefined;
  const [profile] = (await response.json()) as { pro_until: string | null }[];
  return profile;
}

async function upsertRow(row: SubscriptionRow) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?on_conflict=stripe_subscription_id`,
    {
      method: "POST",
      headers: { ...supabaseHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    },
  );
  if (!response.ok) fail(`Upsert ${row.stripe_subscription_id} failed: ${await response.text()}`);
}

async function setProUntil(userId: string, periodEnd: string | null) {
  const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: supabaseHeaders,
    body: JSON.stringify({ pro_until: periodEnd }),
  });
  if (!response.ok) fail(`Profile update ${userId} failed: ${await response.text()}`);
}

const subscriptions = await allStripeSubscriptions();
const rows = await existingRows();

console.log(
  `\nStripe (${stripeEnv}): ${subscriptions.length} subscription(s). Supabase: ${rows.size} row(s).`,
);
console.log(apply ? "Mode: APPLY — writes enabled.\n" : "Mode: dry run — nothing will change.\n");

const problems: string[] = [];
let missingRows = 0;
let staleRows = 0;
let entitlementFixes = 0;
let orphaned = 0;

for (const subscription of subscriptions) {
  const row = subscriptionPayload(subscription, stripeEnv);
  const existing = rows.get(row.stripe_subscription_id);
  const unlocks = subscriptionStillUnlocksPro(row.status, row.current_period_end);
  const label = `${row.stripe_subscription_id} ${row.status.padEnd(18)} user=${row.user_id ?? "MISSING"}`;

  if (!row.user_id) {
    // The webhook keys entitlements off checkout metadata; without it there is
    // nothing to grant Pro to, and guessing by email could grant it to the
    // wrong account.
    orphaned += 1;
    problems.push(
      `ORPHAN   ${label} — no metadata.userId; needs manual matching (customer ${row.stripe_customer_id})`,
    );
    continue;
  }

  if (!existing) {
    missingRows += 1;
    problems.push(`MISSING  ${label} — no subscriptions row${unlocks ? " (should have Pro)" : ""}`);
    if (apply) await upsertRow(row);
  } else if (
    existing.status !== row.status ||
    existing.current_period_end !== row.current_period_end
  ) {
    staleRows += 1;
    problems.push(
      `STALE    ${label} — row says ${existing.status} / ${existing.current_period_end ?? "null"}`,
    );
    if (apply) await upsertRow(row);
  }

  if (unlocks) {
    const profile = await profileProUntil(row.user_id);
    if (!profile) {
      problems.push(`NO USER  ${label} — paid, but no profiles row exists for that id`);
    } else if (profile.pro_until !== row.current_period_end) {
      entitlementFixes += 1;
      problems.push(
        `PRO GAP  ${label} — pro_until ${profile.pro_until ?? "null"} should be ${row.current_period_end}`,
      );
      if (apply) await setProUntil(row.user_id, row.current_period_end);
    }
  }
}

for (const problem of problems) console.log(problem);

console.log(
  `\n${problems.length === 0 ? "Clean: Stripe and Supabase agree." : "Summary"}` +
    (problems.length
      ? `\n  missing rows      ${missingRows}` +
        `\n  stale rows        ${staleRows}` +
        `\n  pro_until gaps    ${entitlementFixes}` +
        `\n  orphaned (manual) ${orphaned}`
      : ""),
);
if (!apply && problems.length > 0) {
  console.log("\nRe-run with --apply to write these changes.");
}
