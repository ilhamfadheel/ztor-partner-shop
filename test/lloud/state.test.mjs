import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { calls, reset, routes, signIn, store } from "./browser.mjs";

const state = await import("../../public/js/ztor/state.js");
const ok = (data) => () => Response.json({ traceId: "t", success: true, code: "0", msg: "", data });
const API = "https://api.example/api/creator/v1";
const eggs = [{ id: "1", title: "Egg", coverUrl: null, rewards: [{ id: "10", title: "Photo", subtitle: null, mediaKind: "photo", previewUrl: null, conditions: [], unlocked: true }, { id: "11", title: "Demo", subtitle: null, mediaKind: "audio", previewUrl: null, conditions: [{ type: "lifetime", target: "100", met: false }], unlocked: false }] }];

beforeEach(() => {
  reset();
  state.forget();
});

function fan() {
  signIn();
  routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fanny", avatarUrl: null, bio: null } })]);
  routes.push(["GET", `${API}/loyalty/me`, ok({ boardScope: "shared", points: 40, tier: "fan", rank: 3, boardSize: 9, next: null })]);
}

test("hydrates a signed-in fan's member, rewards and bag for the page", async () => {
  fan();
  routes.push(["GET", `${API}/vault/eggs`, ok({ eggs })]);
  routes.push(["GET", `${API}/cart`, ok({ shopGroups: [{ shopId: "s", currency: "HKD", items: [{ cartItemId: "c1", productId: "p", quantity: 2, itemStatus: "AVAILABLE", title: "Tee", coverUrl: null, unitPrice: 280, maxQuantity: 5, skuSelections: [] }] }] })]);
  await state.hydrate(["member", "vault", "cart"]);
  const who = state.member();
  assert.deepEqual([who.id, who.name, who.lifetime, who.rank, who.unlockedRewards], ["u-1", "Fanny", 40, 3, ["10"]]);
  assert.deepEqual(state.rewards().map((r) => [r.id, r.unlocked]), [["10", true], ["11", false]]);
  assert.equal(state.lines()[0].qty, 2);
});

test("a visitor is a guest with locked rewards and an empty bag, and no fan route is called", async () => {
  routes.push(["GET", `${API}/vault/eggs`, ok({ eggs: eggs.map((e) => ({ ...e, rewards: e.rewards.map((r) => ({ ...r, unlocked: false })) })) })]);
  await state.hydrate(["member", "vault", "cart"]);
  assert.equal(state.member().guest, true);
  assert.deepEqual(state.lines(), []);
  assert.deepEqual(calls.map((c) => c.url), [`${API}/vault/eggs`]);
});

test("a loyalty service not deployed yet leaves the fan signed in at zero points, and says so", async () => {
  signIn();
  routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fanny" } })]);
  routes.push(["GET", `${API}/loyalty/me`, () => new Response("not found", { status: 404 })]);
  await state.hydrate(["member"]);
  assert.deepEqual([state.member().id, state.member().lifetime, state.member().tier], ["u-1", 0, "fan"]);
  assert.equal(state.unavailable("member"), true);
});

test("remembers which unlocked rewards the fan has opened, per fan", async () => {
  fan();
  routes.push(["GET", `${API}/vault/eggs`, ok({ eggs })]);
  await state.hydrate(["member", "vault"]);
  state.markClaimed("10");
  assert.deepEqual(state.member().claimed, ["10"]);
  assert.ok(store.get("lloud_claimed_v1:u-1"));
});

test("reloads the bag after a change and tells the page", async () => {
  fan();
  let qty = 1;
  routes.push(["GET", `${API}/cart`, () => ok({ shopGroups: [{ shopId: "s", currency: "HKD", items: [{ cartItemId: "c1", productId: "p", quantity: qty, itemStatus: "AVAILABLE", title: "Tee", coverUrl: null, unitPrice: 280, maxQuantity: 5, skuSelections: [] }] }] })()]);
  routes.push(["PATCH", `${API}/cart/items/c1`, () => ((qty = 3), ok({})())]);
  await state.hydrate(["cart"]);
  let told = null;
  document.addEventListener("cart:change", (e) => (told = e.detail), { once: true });
  await state.setQty("c1", 3);
  assert.equal(state.lines()[0].qty, 3);
  assert.deepEqual(told, { type: "qty", id: "c1" });
});

test("loads the published earning rules for the earn-points overlay", async () => {
  routes.push(["GET", `${API}/loyalty/rules`, ok({ version: 1, earn: [{ type: "A4", what: "merch purchase", pointsPerNtd: 10 }], currencies: { HKD: 4 }, tiers: [] })]);
  await state.hydrate(["rules"]);
  assert.deepEqual(state.rules().earn, [{ type: "A4", what: "merch purchase", pointsPerNtd: 10 }]);
});

test("tells a page when a part failed to load, so it can say the shop is resting rather than empty", async () => {
  routes.push(["GET", `${API}/products`, () => Response.json({ traceId: "t", success: false, code: "CREATOR_UPSTREAM_UNAVAILABLE", msg: "An upstream dependency is unavailable.", data: null }, { status: 503 })]);
  await state.hydrate(["products"]);
  assert.deepEqual([state.failed("products"), state.unavailable("products"), state.products()], [true, false, []]);
});
