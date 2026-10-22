import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { calls, reset, routes, signIn } from "./browser.mjs";

const state = await import("../../public/js/ztor/state.js");
const { cart, checkout } = await import("../../public/js/cart.js");
const ok = (data) => () => Response.json({ traceId: "t", success: true, code: "0", msg: "", data });
const API = "https://api.example/api/creator/v1";
const item = (cartItemId, unitPrice, quantity, itemStatus = "AVAILABLE") => ({ cartItemId, productId: "p1", quantity, itemStatus, title: "Tee", coverUrl: null, unitPrice, maxQuantity: 3, skuSelections: [{ skuId: "s1", skuLabel: "M" }] });

beforeEach(() => {
  reset();
  state.forget();
  delete location.assigned;
});

test("a signed-out fan adding to the bag is sent to sign in, back to this page, and nothing is called", async () => {
  await state.hydrate(["member", "cart"]);
  assert.equal(await cart.addProduct("p1", "s1", 1), null);
  assert.equal(location.assigned, "/login?return_to=%2Ffan-club");
  assert.deepEqual(calls.filter((c) => c.url.includes("/cart")), []);
});

test("the bag reads the fan's Ztor cart, and its totals are the buyable lines' subtotal with nothing invented", async () => {
  signIn();
  routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fan" } })]);
  routes.push(["GET", `${API}/loyalty/me`, ok({ points: 0, tier: "fan", rank: null, boardSize: 0, next: null })]);
  routes.push(["GET", `${API}/cart`, ok({ shopGroups: [{ shopId: "s", currency: "HKD", items: [item("c1", 280, 2), item("c2", 50, 1, "SOLD_OUT")] }] })]);
  await state.hydrate(["member", "cart"]);
  assert.equal(cart.count(), 3);
  assert.equal(cart.lineCount(), 2);
  const t = cart.totals();
  assert.deepEqual([t.subtotal, t.shipping, t.tax, t.discount, t.total, t.currency], [560, 0, 0, 0, 560, "HKD"]);
  assert.equal(checkout.totals(560).total, 560);
});

test("adding, changing and removing go to the Creator API, capped by the line's own maximum", async () => {
  signIn();
  routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fan" } })]);
  routes.push(["GET", `${API}/loyalty/me`, ok({ points: 0, tier: "fan", rank: null, boardSize: 0, next: null })]);
  routes.push(["GET", `${API}/cart`, ok({ shopGroups: [{ shopId: "s", currency: "HKD", items: [item("c1", 280, 1)] }] })]);
  routes.push(["POST", `${API}/cart/items`, ok({ cartItemId: "c1" })]);
  routes.push(["PATCH", `${API}/cart/items/c1`, ok({})]);
  routes.push(["DELETE", `${API}/cart/items/c1`, () => new Response(null, { status: 204 })]);
  await state.hydrate(["member", "cart"]);
  let told = 0;
  document.addEventListener("cart:change", () => told++);
  assert.equal(await cart.addProduct("p1", "s1", 2), "c1");
  assert.deepEqual(JSON.parse(calls.find((c) => c.method === "POST").body), { product_id: "p1", sku_id: "s1", qty: 2 });
  await cart.setQty("c1", 50);
  assert.deepEqual(JSON.parse(calls.find((c) => c.method === "PATCH").body), { qty: 3 });
  await cart.setQty("c1", 0);
  assert.ok(calls.some((c) => c.method === "DELETE"));
  assert.equal(told, 3);
});
