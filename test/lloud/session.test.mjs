import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { calls, locks, reset, routes, signIn, store, idToken } from "./browser.mjs";

const { currentSession, signOut } = await import("../../public/js/ztor/session.js");
const stored = () => JSON.parse(store.get("ztor_session") ?? "null");
const tokenAnswer = (status, body) => routes.push(["POST", "https://sso.example/sso/token", () => Response.json(body, { status })]);

beforeEach(reset);

test("uses a session with more than a minute left as it is", async () => {
  signIn(10 * 60_000);
  assert.equal((await currentSession())?.accessToken, "at-1");
  assert.equal(calls.length, 0);
});

test("renews a session about to expire with the refresh token, for the shop API, and keeps the rotated token", async () => {
  signIn(30_000);
  tokenAnswer(200, { access_token: "at-2", refresh_token: "rt-2", id_token: idToken("Fan Renamed"), expires_in: 3600 });
  assert.equal((await currentSession())?.accessToken, "at-2");
  const body = new URLSearchParams(calls.find((c) => c.url.endsWith("/token")).body);
  assert.deepEqual([body.get("grant_type"), body.get("refresh_token"), body.get("client_id"), body.get("resource")], ["refresh_token", "rt-1", "shop-1", "https://api.example/api/creator"]);
  assert.equal(stored().refreshToken, "rt-2");
  assert.equal(stored().user.name, "Fan Renamed");
});

test("renews once for concurrent callers, and not at all when another tab already did", async () => {
  signIn(30_000);
  tokenAnswer(200, { access_token: "at-2", refresh_token: "rt-2", id_token: idToken(), expires_in: 3600 });
  const [a, b] = await Promise.all([currentSession(), currentSession()]);
  assert.equal(a?.accessToken, "at-2");
  assert.equal(b?.accessToken, "at-2");
  assert.equal(calls.filter((c) => c.url.endsWith("/token")).length, 1);

  reset();
  signIn(30_000);
  locks.before = () => signIn(10 * 60_000, "rt-other");
  assert.equal((await currentSession())?.refreshToken, "rt-other");
  assert.equal(calls.filter((c) => c.url.endsWith("/token")).length, 0);
});

test("ends the sign-in when Ztor refuses the refresh token, keeps it when Ztor is down", async () => {
  signIn(30_000);
  tokenAnswer(503, { error: "temporarily_unavailable" });
  assert.equal((await currentSession())?.accessToken, "at-1");
  assert.ok(stored());
  reset();
  signIn(30_000);
  tokenAnswer(400, { error: "invalid_grant" });
  assert.equal(await currentSession(), null);
  assert.equal(stored(), null);
});

test("is signed out when nothing is stored", async () => {
  assert.equal(await currentSession(), null);
});

test("signs out of this site only: revokes the refresh then the access token, clears the session", async () => {
  signIn();
  routes.push(["POST", "https://sso.example/sso/revoke", () => new Response(null, { status: 200 })]);
  await signOut("/fan-club");
  const revoked = calls.filter((c) => c.url.endsWith("/revoke")).map((c) => new URLSearchParams(c.body).get("token_type_hint"));
  assert.deepEqual(revoked, ["refresh_token", "access_token"]);
  assert.equal(stored(), null);
  assert.equal(location.assigned, "/fan-club");
});

test("the hosted sign-in buttons come from the console on the issuer's origin, with this site's client, callback, scope and resource", async () => {
  const { signInEmbed } = await import("../../public/js/ztor/session.js");
  assert.deepEqual(signInEmbed("https://shop.example"), {
    base: "https://sso.example/embed/v1",
    attributes: { "data-client-id": "shop-1", "data-redirect-uri": "https://shop.example/auth/callback", "data-scope": "openid email profile offline_access", "data-resource": "https://api.example/api/creator" },
  });
});

test("remembers where to go after a sign-in the hosted buttons start (they keep only verifier and state)", async () => {
  const { rememberReturnTo } = await import("../../public/js/ztor/session.js");
  const saved = new Map();
  globalThis.sessionStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) };
  rememberReturnTo("/rewards?reward=2");
  assert.equal(saved.get("ztor_return_to"), "/rewards?reward=2");
  rememberReturnTo("https://evil.example/");
  assert.equal(saved.get("ztor_return_to"), "/");
});
