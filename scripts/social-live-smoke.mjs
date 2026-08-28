/**
 * Destructive-but-self-cleaning production smoke test for DEADSET social RPCs.
 *
 * Creates two short-lived verified users, exercises search, location, friend
 * requests, acceptance, public cards and removal through the same live Worker
 * used by the iPhone, then deletes both users in a finally block.
 *
 * Run with:
 *   node --env-file=.env scripts/social-live-smoke.mjs
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const rpcOrigin = (process.env.DEADSET_RPC_ORIGIN || "https://deadsetfit.org").replace(/\/$/, "");

if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY are required");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const password = `Qa-${randomBytes(18).toString("base64url")}!`;
const createdUserIds = [];

function client() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createQaAthlete(label, city) {
  const email = `deadset-social-${label}-${suffix}@example.com`;
  const username = `qa_${label}_${suffix}`.slice(0, 24);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `QA ${label.toUpperCase()}` },
  });
  if (error || !data.user) throw error ?? new Error("QA user creation failed");
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username,
      display_name: `QA ${label.toUpperCase()}`,
      bio: "Temporary DEADSET release smoke test",
      city,
      country: "United Kingdom",
      location_updated_at: new Date().toISOString(),
      grit_points: label === "alpha" ? 120 : 180,
      public_stats: {
        overall: label === "alpha" ? 42 : 51,
        streak: label === "alpha" ? 3 : 5,
        totalWorkouts: 4,
        totalWorkingSets: 48,
        totalPRs: 2,
      },
    })
    .eq("id", data.user.id);
  if (profileError) throw profileError;

  const authClient = client();
  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !sessionData.session) {
    throw signInError ?? new Error("QA user sign-in failed");
  }
  return { id: data.user.id, username, token: sessionData.session.access_token };
}

async function rpc(athlete, fn, data) {
  const response = await fetch(`${rpcOrigin}/api/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${athlete.token}`,
    },
    body: JSON.stringify({ fn, data }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(`${fn} failed (${response.status}): ${payload?.error || "invalid response"}`);
  }
  return payload.result;
}

async function run() {
  const alpha = await createQaAthlete("alpha", "Leeds");
  const beta = await createQaAthlete("beta", "Leeds");

  const search = await rpc(alpha, "searchAthletes", { q: `@${beta.username}` });
  assert(
    search.some((athlete) => athlete.id === beta.id),
    `search must return @${beta.username}; got ${JSON.stringify(
      search.map((athlete) => ({ id: athlete.id, username: athlete.username })),
    )}`,
  );

  const displaySearch = await rpc(alpha, "searchAthletes", { q: "QA BETA" });
  assert(
    displaySearch.some((athlete) => athlete.id === beta.id),
    "display-name search must return the matching athlete",
  );

  const suggested = await rpc(alpha, "getSuggestedAthletes");
  assert(Array.isArray(suggested), "suggestions must return a list");

  const nearby = await rpc(alpha, "getNearbyAthletes");
  assert.equal(nearby.myCity, "Leeds");
  assert(nearby.athletes.some((athlete) => athlete.id === beta.id), "nearby must include same-city athlete");

  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "send" }), {
    ok: true,
    status: "OUTGOING",
  });
  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "cancel" }), {
    ok: true,
    status: "NONE",
  });
  assert(!(await rpc(alpha, "getFriendConnections")).outgoing.some((athlete) => athlete.id === beta.id));

  await rpc(alpha, "updateFriendship", { userId: beta.id, action: "send" });
  assert.deepEqual(await rpc(beta, "updateFriendship", { userId: alpha.id, action: "decline" }), {
    ok: true,
    status: "NONE",
  });
  assert(!(await rpc(alpha, "getFriendConnections")).outgoing.some((athlete) => athlete.id === beta.id));

  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "send" }), {
    ok: true,
    status: "OUTGOING",
  });
  const alphaPending = await rpc(alpha, "getFriendConnections");
  const betaPending = await rpc(beta, "getFriendConnections");
  assert(alphaPending.outgoing.some((athlete) => athlete.id === beta.id));
  assert(betaPending.incoming.some((athlete) => athlete.id === alpha.id));
  const betaNotifications = await rpc(beta, "getNotifications");
  assert(
    betaNotifications.some(
      (notification) => notification.type === "follow" && notification.actor?.id === alpha.id,
    ),
    "a friend request must appear in the recipient's notification inbox",
  );

  assert.deepEqual(await rpc(beta, "updateFriendship", { userId: alpha.id, action: "accept" }), {
    ok: true,
    status: "FRIEND",
  });
  const alphaFriends = await rpc(alpha, "getFriendConnections");
  const betaFriends = await rpc(beta, "getFriendConnections");
  assert(alphaFriends.friends.some((athlete) => athlete.id === beta.id));
  assert(betaFriends.friends.some((athlete) => athlete.id === alpha.id));

  const card = await rpc(alpha, "getAthleteCard", { userId: beta.id });
  assert.equal(card.following, true);
  assert.equal(card.followsMe, true);
  assert.equal(card.city, "Leeds");

  await rpc(beta, "updateMyLocation", {
    city: "Manchester",
    country: "United Kingdom",
    region: null,
  });
  const movedNearby = await rpc(alpha, "getNearbyAthletes");
  assert(!movedNearby.athletes.some((athlete) => athlete.id === beta.id));

  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "remove" }), {
    ok: true,
    status: "NONE",
  });
  const afterRemoval = await rpc(beta, "getFriendConnections");
  assert(!afterRemoval.friends.some((athlete) => athlete.id === alpha.id));

  await rpc(beta, "updateMyLocation", { city: "Leeds", country: "United Kingdom", region: null });
  assert((await rpc(alpha, "getNearbyAthletes")).athletes.some((athlete) => athlete.id === beta.id));
  assert.deepEqual(await rpc(alpha, "blockUser", { userId: beta.id }), { blocked: true });
  const blockedSearch = await rpc(alpha, "searchAthletes", { q: `@${beta.username}` });
  assert(!blockedSearch.some((athlete) => athlete.id === beta.id), "blocked athletes must be hidden from search");
  assert(!(await rpc(alpha, "getNearbyAthletes")).athletes.some((athlete) => athlete.id === beta.id));
  assert.deepEqual(await rpc(alpha, "unblockUser", { userId: beta.id }), { blocked: false });

  await rpc(alpha, "updateMyLocation", { city: "", country: "", region: null });
  assert.deepEqual(await rpc(alpha, "getNearbyAthletes"), {
    athletes: [],
    myCity: null,
    myCountry: null,
  });

  console.log(
    "Live social smoke test passed: username/display search, nearby, send/cancel/decline/accept/remove, inbox notifications, card comparison, block privacy and location clearing.",
  );
}

try {
  await run();
} finally {
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`QA cleanup failed for ${userId}: ${error.message}`);
  }
}
