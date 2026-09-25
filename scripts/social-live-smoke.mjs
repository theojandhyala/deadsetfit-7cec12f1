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
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY are required",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const password = `Qa-${randomBytes(18).toString("base64url")}!`;
const createdUserIds = [];
const localHandler = process.argv.includes("--local-handler")
  ? (await import("../api/rpc.ts")).default
  : null;

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
  if (localHandler) {
    let status = 200;
    let payload;
    const res = {
      setHeader() {
        return res;
      },
      status(code) {
        status = code;
        return res;
      },
      json(value) {
        payload = value;
        return res;
      },
    };
    await localHandler(
      { method: "POST", headers: { authorization: `Bearer ${athlete.token}` }, body: { fn, data } },
      res,
    );
    if (status !== 200 || payload?.error)
      throw new Error(`${fn} failed (${status}): ${payload?.error}`);
    return payload.result;
  }
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

  assert.deepEqual(await rpc(alpha, "getAthleteActivity", { userId: alpha.id }), {
    posts: [],
    next: null,
  });
  // Historical timestamps keep disposable fixtures away from today's global feed.
  const { error: activitySeedError } = await admin.from("posts").insert(
    Array.from({ length: 13 }, (_, n) => ({
      user_id: beta.id,
      kind: n === 0 ? "pr" : "text",
      content: "Temporary release QA activity",
      metadata: n === 0 ? { lift: "Bench", weight: 80, reps: 5 } : {},
      created_at: "2000-01-01T10:00:00Z",
    })),
  );
  if (activitySeedError) throw activitySeedError;
  const activityFirst = await rpc(alpha, "getAthleteActivity", { userId: beta.id });
  assert.equal(activityFirst.posts.length, 12);
  assert(activityFirst.next);
  assert(activityFirst.posts.every((post) => post.user_id === beta.id));
  const { error: newerPostError } = await admin
    .from("posts")
    .insert({
      user_id: beta.id,
      kind: "text",
      content: "Temporary newer QA activity",
      created_at: "2001-01-01T10:00:00Z",
    });
  if (newerPostError) throw newerPostError;
  const activityLast = await rpc(alpha, "getAthleteActivity", {
    userId: beta.id,
    before: activityFirst.next,
  });
  assert.equal(activityLast.posts.length, 1, "inserting a newer post must not shift the cursor");
  assert.equal(activityLast.next, null);
  assert.equal(
    new Set([...activityFirst.posts, ...activityLast.posts].map((post) => post.id)).size,
    13,
  );
  assert.deepEqual(Object.keys(activityFirst.posts[0]).sort(), [
    "content",
    "created_at",
    "id",
    "image_url",
    "kind",
    "metadata",
    "user_id",
  ]);
  await assert.rejects(rpc({ token: "" }, "getAthleteActivity", { userId: beta.id }));
  await assert.rejects(rpc(alpha, "getAthleteActivity", { userId: "invalid" }));
  await assert.rejects(
    rpc(alpha, "getAthleteActivity", {
      userId: beta.id,
      before: { id: beta.id, createdAt: "bad" },
    }),
  );

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
  assert(
    nearby.athletes.some((athlete) => athlete.id === beta.id),
    "nearby must include same-city athlete",
  );

  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "send" }), {
    ok: true,
    status: "OUTGOING",
  });
  assert.deepEqual(await rpc(alpha, "updateFriendship", { userId: beta.id, action: "cancel" }), {
    ok: true,
    status: "NONE",
  });
  assert(
    !(await rpc(alpha, "getFriendConnections")).outgoing.some((athlete) => athlete.id === beta.id),
  );

  await rpc(alpha, "updateFriendship", { userId: beta.id, action: "send" });
  assert.deepEqual(await rpc(beta, "updateFriendship", { userId: alpha.id, action: "decline" }), {
    ok: true,
    status: "NONE",
  });
  assert(
    !(await rpc(alpha, "getFriendConnections")).outgoing.some((athlete) => athlete.id === beta.id),
  );

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

  const gymName = `QA Lift Club ${suffix}`;
  await rpc(alpha, "updateMyGym", { gymName });
  await rpc(beta, "updateMyGym", { gymName });
  const gyms = await rpc(alpha, "searchLocalGyms", { q: gymName });
  assert(gyms.gyms.some((gym) => gym.name === gymName && gym.memberCount === 2));
  const gym = await rpc(alpha, "getGymHub");
  assert.equal(gym.gymName, gymName);
  assert(
    gym.athletes.some((athlete) => athlete.id === beta.id),
    "joined athlete must appear on gym board",
  );
  await rpc(beta, "updateMyGym", { gymName: "" });
  assert(!(await rpc(alpha, "getGymHub")).athletes.some((athlete) => athlete.id === beta.id));
  await rpc(alpha, "updateMyGym", { gymName: "" });

  const followers = await rpc(alpha, "getAthleteConnections", {
    userId: beta.id,
    direction: "followers",
  });
  assert(followers.athletes.some((row) => row.id === alpha.id && row.isMe));
  const following = await rpc(alpha, "getAthleteConnections", {
    userId: alpha.id,
    direction: "following",
  });
  assert(following.athletes.some((row) => row.id === beta.id && row.following && row.followsMe));
  assert.equal(following.nextOffset, null);
  assert.deepEqual(
    await rpc(alpha, "getAthleteConnections", {
      userId: alpha.id,
      direction: "following",
      offset: 30,
    }),
    { athletes: [], nextOffset: null },
  );
  await assert.rejects(rpc(alpha, "setAthleteFollow", { userId: alpha.id, following: true }));
  await assert.rejects(
    rpc({ token: "" }, "getAthleteConnections", { userId: alpha.id, direction: "followers" }),
  );
  await assert.rejects(
    rpc(alpha, "getAthleteConnections", { userId: alpha.id, direction: "followers", offset: -1 }),
  );
  await rpc(alpha, "setAthleteFollow", { userId: beta.id, following: false });
  await rpc(alpha, "setAthleteFollow", { userId: beta.id, following: false });
  const oneWay = await rpc(alpha, "getAthleteCard", { userId: beta.id });
  assert.equal(oneWay.following, false);
  assert.equal(oneWay.followsMe, true, "unfollow preserves the other person's choice");
  await rpc(alpha, "setAthleteFollow", { userId: beta.id, following: true });
  await rpc(alpha, "setAthleteFollow", { userId: beta.id, following: true });
  assert.equal(
    (await rpc(alpha, "getMyFollowStats")).following,
    1,
    "retries must not duplicate follows",
  );

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
  assert(
    (await rpc(alpha, "getNearbyAthletes")).athletes.some((athlete) => athlete.id === beta.id),
  );
  await rpc(alpha, "setAthleteFollow", { userId: beta.id, following: true });
  await rpc(beta, "setAthleteFollow", { userId: alpha.id, following: true });
  const gamma = await createQaAthlete("gamma", "Leeds");
  await rpc(alpha, "setAthleteFollow", { userId: gamma.id, following: true });
  await rpc(gamma, "setAthleteFollow", { userId: alpha.id, following: true });
  await rpc(beta, "setAthleteFollow", { userId: gamma.id, following: true });
  assert.deepEqual(
    await rpc(alpha, "getMutualFriends", { userId: beta.id }),
    { athletes: [] },
    "three edges are not a shared friendship",
  );
  await rpc(gamma, "setAthleteFollow", { userId: beta.id, following: true });
  const mutuals = await rpc(alpha, "getMutualFriends", { userId: beta.id });
  assert.deepEqual(
    mutuals.athletes.map((row) => row.id),
    [gamma.id],
  );
  assert.deepEqual(Object.keys(mutuals.athletes[0]).sort(), [
    "avatar_url",
    "display_name",
    "id",
    "username",
  ]);
  await assert.rejects(rpc({ token: "" }, "getMutualFriends", { userId: beta.id }));
  await assert.rejects(rpc(alpha, "getMutualFriends", { userId: "invalid" }));
  await rpc(alpha, "blockUser", { userId: gamma.id });
  assert.deepEqual(await rpc(alpha, "getMutualFriends", { userId: beta.id }), { athletes: [] });
  await rpc(beta, "blockUser", { userId: gamma.id });
  assert.deepEqual(await rpc(alpha, "blockUser", { userId: beta.id }), { blocked: true });
  await assert.rejects(rpc(alpha, "getAthleteActivity", { userId: beta.id }));
  await assert.rejects(rpc(beta, "getAthleteActivity", { userId: alpha.id }));
  await assert.rejects(rpc(alpha, "getMutualFriends", { userId: beta.id }));
  await assert.rejects(rpc(beta, "getMutualFriends", { userId: alpha.id }));
  await assert.rejects(rpc(beta, "setAthleteFollow", { userId: alpha.id, following: true }));
  await assert.rejects(rpc(beta, "toggleFollow", { userId: alpha.id }));
  await assert.rejects(rpc(alpha, "getAthleteCard", { userId: beta.id }));
  await assert.rejects(
    rpc(beta, "getAthleteConnections", { userId: alpha.id, direction: "following" }),
  );
  assert.equal((await rpc(alpha, "getMyFollowStats")).following, 0);
  assert.equal(
    (await rpc(beta, "getMyFollowStats")).following,
    0,
    "block removes the incoming edge too",
  );
  const blockedSearch = await rpc(alpha, "searchAthletes", { q: `@${beta.username}` });
  assert(
    !blockedSearch.some((athlete) => athlete.id === beta.id),
    "blocked athletes must be hidden from search",
  );
  assert(
    !(await rpc(alpha, "getNearbyAthletes")).athletes.some((athlete) => athlete.id === beta.id),
  );
  assert.deepEqual(await rpc(alpha, "unblockUser", { userId: beta.id }), { blocked: false });

  await rpc(alpha, "updateMyLocation", { city: "", country: "", region: null });
  assert.deepEqual(await rpc(alpha, "getNearbyAthletes"), {
    athletes: [],
    myCity: null,
    myCountry: null,
  });

  console.log(
    "Social smoke passed: profile activity pagination, author isolation and privacy; search, nearby, gym join/search/leaderboard/leave, friendship lifecycle, followers/following, mutual friendships and privacy, idempotent follow/unfollow, auth/validation rejection, block privacy, notifications and location clearing.",
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
