import assert from "node:assert/strict";
import { test } from "node:test";
import "./browser.mjs";

const c = await import("../../public/js/ztor/commerce.js");

const SIZE = "o-size", COLOUR = "o-col";
const v = (optionId, optionValueId) => ({ optionId, optionValueId, valueName: optionValueId });
const sku = (skuId, size, colour, extra = {}) => ({ skuId, label: `${size} / ${colour}`, effectivePrice: 30, originalPrice: null, availabilityStatus: "AVAILABLE", sellable: true, stockQuantity: 5, selectedOptions: [v(SIZE, size), v(COLOUR, colour)], ...extra });
const tee = {
  productId: "p1",
  currency: "HKD",
  minPrice: 30,
  maxPrice: 40,
  sellable: true,
  purchaseLimit: 3,
  options: [
    { optionId: SIZE, optionName: "Size", values: [{ optionValueId: "S", valueName: "S" }, { optionValueId: "M", valueName: "M" }, { optionValueId: "L", valueName: "L" }] },
    { optionId: COLOUR, optionName: "Colour", values: [{ optionValueId: "black", valueName: "Black", colorCode: "#000" }, { optionValueId: "white", valueName: "White", colorCode: "#fff" }] },
  ],
  skus: [
    sku("s-b", "S", "black"),
    sku("s-w", "S", "white", { stockQuantity: 0 }), // sold out
    sku("m-b", "M", "black", { effectivePrice: 40, originalPrice: 50 }),
    sku("m-w", "M", "white", { sellable: false }), // not sellable
    // L only comes in white
    sku("l-w", "L", "white", { stockQuantity: 2 }),
  ],
};

test("a SKU is resolved only once every option has a value, and is the SKU carrying exactly those values", () => {
  assert.equal(c.resolveSku(tee, {}), null);
  assert.equal(c.resolveSku(tee, { [SIZE]: "M" }), null);
  assert.equal(c.resolveSku(tee, { [SIZE]: "M", [COLOUR]: "black" }).skuId, "m-b");
  assert.equal(c.resolveSku(tee, { [SIZE]: "L", [COLOUR]: "black" }), null, "a combination with no SKU resolves to nothing");
});

test("a product without options is its only SKU", () => {
  const single = { ...tee, options: [], skus: [{ ...sku("one", "-", "-"), selectedOptions: [] }] };
  assert.equal(c.resolveSku(single, {}).skuId, "one");
});

test("a value is unavailable when no buyable SKU has it with the other picked values (sold out, not sellable, or missing)", () => {
  // nothing picked: every value some buyable SKU carries
  assert.deepEqual(tee.options[0].values.map((x) => c.valueAvailable(tee, {}, SIZE, x.optionValueId)), [true, true, true]);
  // black picked: L has no black SKU
  assert.equal(c.valueAvailable(tee, { [COLOUR]: "black" }, SIZE, "L"), false);
  // white picked: S/white is sold out, M/white isn't sellable, L/white is fine
  assert.deepEqual(["S", "M", "L"].map((s) => c.valueAvailable(tee, { [COLOUR]: "white" }, SIZE, s)), [false, false, true]);
  // the option's own pick doesn't constrain its other values
  assert.equal(c.valueAvailable(tee, { [SIZE]: "S" }, SIZE, "L"), true);
});

test("picking a value drops the other picks it can't be bought with", () => {
  assert.deepEqual(c.pickValue(tee, { [COLOUR]: "black" }, SIZE, "M"), { [COLOUR]: "black", [SIZE]: "M" });
  assert.deepEqual(c.pickValue(tee, { [COLOUR]: "black" }, SIZE, "L"), { [SIZE]: "L" });
});

test("options with a single value are picked for the fan; the first unpicked option is the one to ask for", () => {
  const oneColour = { ...tee, options: [tee.options[0], { ...tee.options[1], values: [tee.options[1].values[0]] }] };
  assert.deepEqual(c.initialPicks(oneColour), { [COLOUR]: "black" });
  assert.deepEqual(c.initialPicks(tee), {});
  assert.equal(c.firstMissing(tee, { [COLOUR]: "black" }), SIZE);
  assert.equal(c.firstMissing(tee, { [COLOUR]: "black", [SIZE]: "S" }), null);
});

test("sold out follows Ztor's rule: not sellable, or no stock left", () => {
  assert.equal(c.isSoldOut({ sellable: true, stockQuantity: 3 }), false);
  assert.equal(c.isSoldOut({ sellable: true, stockQuantity: null }), false);
  assert.equal(c.isSoldOut({ sellable: true, stockQuantity: 0 }), true);
  assert.equal(c.isSoldOut({ sellable: false, stockQuantity: 9 }), true);
});

test("the price is a range until a SKU is picked, then that SKU's price (and what it was, when discounted)", () => {
  assert.deepEqual(c.priceOf(tee, null), { now: "HK$ 30 – HK$ 40", was: null });
  assert.deepEqual(c.priceOf({ ...tee, maxPrice: 30 }, null), { now: "HK$ 30", was: null });
  assert.deepEqual(c.priceOf(tee, tee.skus[2]), { now: "HK$ 40", was: "HK$ 50" });
});

test("the quantity is capped by the purchase limit, the SKU's stock and the bag's ceiling", () => {
  assert.equal(c.qtyCap(tee, null), 3);
  assert.equal(c.qtyCap(tee, tee.skus[4]), 2);
  assert.equal(c.qtyCap({ ...tee, purchaseLimit: 0 }, null), 99);
  assert.equal(c.qtyCap({ ...tee, purchaseLimit: 0 }, { ...tee.skus[0], stockQuantity: null }), 99);
});

test("the gallery keeps the seller's order, marks videos and drops unusable entries", () => {
  const items = c.galleryItems([
    { type: "IMAGE", url: "image/b.png", sortOrder: 2 },
    { type: "VIDEO", url: "https://cdn.example/v.mp4", sortOrder: 1 },
    { type: "IMAGE", url: "video/1/clip.mov", sortOrder: 3 },
    { type: "IMAGE", url: " ", sortOrder: 4 },
  ]);
  assert.deepEqual(items, [
    { type: "VIDEO", url: "https://cdn.example/v.mp4" },
    { type: "IMAGE", url: "https://cdn.example/image/b.png" },
    { type: "VIDEO", url: "https://cdn.example/video/1/clip.mov" },
  ]);
});

const line = (id, price, qty, status = "AVAILABLE", currency = "HKD") => ({ id, slug: "p", skuId: "s", size: "M", colour: "", title: "Tee", price, currency, image: "", qty, max: 5, status });

test("the bag's totals are the subtotal of its buyable lines, nothing invented", () => {
  const t = c.bagTotals([line("a", 280, 2), line("b", 100, 1), line("c", 999, 1, "SOLD_OUT")]);
  assert.deepEqual(t, { count: 4, subtotal: 660, currency: "HKD", shipping: 0, tax: 0, discount: 0, total: 660, note: "Delivery and any discounts are calculated at checkout" });
  assert.deepEqual(c.bagTotals([]).subtotal, 0);
  assert.deepEqual(c.payableLineIds([line("a", 1, 1), line("c", 1, 1, "SKU_UNAVAILABLE")]), ["a"]);
});

test("a line's status reads as words; a buyable line has none", () => {
  assert.equal(c.lineStatusText("AVAILABLE"), "");
  assert.equal(c.lineStatusText("SOLD_OUT"), "Sold out");
  assert.equal(c.lineStatusText("CONFIGURATION_CHANGED"), "Configuration changed");
});

test("a new pickup contact needs a name and a phone", () => {
  assert.deepEqual(c.contactErrors({ name: " ", phone: "" }), { name: "Enter the name of whoever collects the order.", phone: "Enter a phone number we can reach them on." });
  assert.deepEqual(c.contactErrors({ name: "Ann", phone: "+852 5555 0000" }), {});
});

test("the checkout body carries the lines, the method, the quote's hash, the callback and the pickup contact", () => {
  const quote = { confirmationHash: "h-1", canCreate: true };
  assert.deepEqual(c.checkoutBody({ lineIds: ["a"], method: "PAYPAL", quote, contactId: "c-9", contact: null, origin: "https://shop.example" }), {
    cart_item_ids: ["a"],
    payment_method: "PAYPAL",
    confirmation_hash: "h-1",
    callback_url: "https://shop.example/checkout/done",
    pickup_contact_id: "c-9",
  });
  assert.deepEqual(c.checkoutBody({ lineIds: ["a", "b"], method: "CARD", quote, contactId: "new", contact: { name: " Ann ", phone: " 123 " }, origin: "https://shop.example" }).pickup_contact, { name: "Ann", phone: "123" });
});

test("after checkout the fan goes to the payment page (https only), otherwise to the result page", () => {
  assert.equal(c.afterCheckout({ paymentAction: "ACTION_REQUIRED", paymentUrl: "https://pay.example/x" }), "https://pay.example/x");
  assert.equal(c.afterCheckout({ paymentAction: "ACTION_REQUIRED", paymentUrl: "javascript:alert(1)" }), "/checkout/done");
  assert.equal(c.afterCheckout({ paymentAction: "ALREADY_PAID", paymentUrl: "https://pay.example/x" }), "/checkout/done");
});

test("the remembered payment method is used when the shop still offers it, else the first", () => {
  const methods = [{ methodCode: "CARD" }, { methodCode: "PAYPAL" }];
  assert.equal(c.preferredMethod(methods, "PAYPAL"), "PAYPAL");
  assert.equal(c.preferredMethod(methods, "ALIPAY"), "CARD");
  assert.equal(c.preferredMethod([], "PAYPAL"), "");
});

test("fulfilment reads as shipping, or the pickup session still open", () => {
  assert.equal(c.fulfilmentText({ fulfillmentType: "SHIPPING" }), "Ships to you");
  assert.equal(c.fulfilmentText({ fulfillmentType: "QR_PICKUP", pickup: { sessions: [{ name: "Old", location: "A", statusCode: "ENDED" }, { name: "Hall", location: "B", statusCode: "ACTIVE" }, { name: "X", location: "" }] } }), "Pickup at Hall, B (+2 more)");
  assert.equal(c.fulfilmentText({ fulfillmentType: "QR_PICKUP", pickup: null }), "Pickup with a QR code");
});
