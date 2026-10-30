import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { calls, reset, routes, signIn } from "./browser.mjs";

const { api, ApiError } = await import("../../public/js/ztor/api.js");
const ok = (data) => () => Response.json({ traceId: "t", success: true, code: "0", msg: "", data });
const refuse = (status, code, msg) => () => Response.json({ traceId: "t", success: false, code, msg, data: null }, { status });

beforeEach(reset);

test("calls the Creator API with the channel key, and the fan's token where the route needs one", async () => {
  signIn();
  routes.push(["GET", "https://api.example/api/creator/v1/loyalty/me", ok({ points: 10 })]);
  assert.deepEqual(await api.me(), { points: 10 });
  assert.equal(calls.at(-1).headers["x-channel-key"], "shop-1");
  assert.equal(calls.at(-1).headers.authorization, "Bearer at-1");
});

test("sends no token on public routes, and the token when a fan is signed in on optional ones", async () => {
  routes.push(["GET", "https://api.example/api/creator/v1/vault/eggs", ok({ eggs: [] })]);
  await api.eggs();
  assert.equal(calls.at(-1).headers.authorization, undefined);
  signIn();
  await api.eggs();
  assert.equal(calls.at(-1).headers.authorization, "Bearer at-1");
});

test("refuses a fan route while signed out without calling anything", async () => {
  await assert.rejects(api.me(), (e) => e instanceof ApiError && e.status === 401 && e.code === "SIGNED_OUT");
  assert.equal(calls.length, 0);
});

test("turns a refusal into an ApiError with its status and code", async () => {
  signIn();
  routes.push(["POST", "https://api.example/api/creator/v1/vault/rewards/9/open", refuse(403, "CREATOR_REWARD_LOCKED", "This reward is locked.")]);
  await assert.rejects(api.openReward("9"), (e) => e instanceof ApiError && e.status === 403 && e.code === "CREATOR_REWARD_LOCKED" && e.message === "This reward is locked.");
});

test("sends the body, the idempotency key and the method of a checkout", async () => {
  signIn();
  routes.push(["POST", "https://api.example/api/creator/v1/checkout", ok({ paymentUrl: "https://pay.example" })]);
  await api.checkout({ cart_item_ids: ["1"] }, "idem-1");
  const call = calls.at(-1);
  assert.equal(call.headers["idempotency-key"], "idem-1");
  assert.deepEqual(JSON.parse(call.body), { cart_item_ids: ["1"] });
});

test("reads the fan's Ztor account through its own envelope", async () => {
  signIn();
  routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fanny" } })]);
  assert.deepEqual(await api.account(), { name: "Fanny" });
  routes.length = 0;
  routes.push(["PATCH", "https://api.example/api/api/v1/account", () => Response.json({ code: 400, msg: "bad", data: { reason: "VALIDATION", message: "Name too long" } })]);
  await assert.rejects(api.updateAccount({ name: "x" }), (e) => e instanceof ApiError && e.code === "VALIDATION" && e.message === "Name too long");
});

test("is unavailable, not broken, when an endpoint is not deployed yet", async () => {
  routes.push(["GET", "https://api.example/api/creator/v1/loyalty/rules", () => new Response("<html>404</html>", { status: 404 })]);
  await assert.rejects(api.rules(), (e) => e instanceof ApiError && e.status === 404 && e.code === "UNAVAILABLE");
});

// ── missions, invites and reward codes (CONTRACT §7.1) ─────────────────────────
test("missions: a visitor's list carries no token, a fan's does; the missions come out of the envelope", async () => {
  routes.push(["GET", "https://api.example/api/creator/v1/missions", ok({ missions: [{ id: "41" }] })]);
  assert.deepEqual(await api.missions(), [{ id: "41" }]);
  assert.equal(calls.at(-1).headers.authorization, undefined);
  signIn();
  await api.missions();
  assert.equal(calls.at(-1).headers.authorization, "Bearer at-1");
});

test("submitProof sends proof_url and note only when set, as the fan, and returns the mission", async () => {
  signIn();
  routes.push(["POST", "https://api.example/api/creator/v1/missions/41/submissions", ok({ mission: { id: "41", me: { state: "pending" } } })]);
  assert.deepEqual(await api.submitProof("41", { proofUrl: "https://instagram.com/p/x", note: "" }), { id: "41", me: { state: "pending" } });
  assert.deepEqual(JSON.parse(calls.at(-1).body), { proof_url: "https://instagram.com/p/x" });
  await api.submitProof("41", { note: "The bridge." });
  assert.deepEqual(JSON.parse(calls.at(-1).body), { note: "The bridge." });
  assert.equal(calls.at(-1).method, "POST");
  assert.equal(calls.at(-1).headers.authorization, "Bearer at-1");
});

test("the fan's invitation and a claim both need the fan, and send the code as code", async () => {
  await assert.rejects(api.invite(), (e) => e.code === "SIGNED_OUT");
  await assert.rejects(api.claimInvite("7KQ2M9XA"), (e) => e.code === "SIGNED_OUT");
  assert.equal(calls.length, 0);
  signIn();
  routes.push(["GET", "https://api.example/api/creator/v1/invites/me", ok({ code: "7KQ2M9XA", counted: 2 })]);
  routes.push(["POST", "https://api.example/api/creator/v1/invites/claim", ok({ counted: true, alreadyCounted: false })]);
  assert.deepEqual(await api.invite(), { code: "7KQ2M9XA", counted: 2 });
  assert.deepEqual(await api.claimInvite("7kq2-m9xa"), { counted: true, alreadyCounted: false });
  assert.deepEqual(JSON.parse(calls.at(-1).body), { code: "7kq2-m9xa" });
});
