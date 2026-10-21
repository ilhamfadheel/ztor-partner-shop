import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelledCards, displayStatusKey, groupBySession, pickupCards, pickupProgressText, pieceLabel, sessionWindow } from "./pickup.ts";
import type { Order, OrderItem, OrderQrCode } from "./shop.ts";

const session = { sessionId: "7", createdAt: 2, name: "Fan meet pickup", location: "Hall B", instruction: "Show the QR at the desk", startAt: Date.UTC(2026, 8, 1, 3), endAt: Date.UTC(2026, 8, 1, 10) };
const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  orderItemId: "1", productId: "100", productType: "SINGLE", title: "Tour Tee", coverUrl: "t.png", specification: "M",
  quantity: 1, currency: "HKD", unitAmount: "120", totalAmount: "120", fulfilmentStatus: "TO_SHIP", fulfillmentType: "QR_PICKUP", bundleItems: [], ...over,
});
const qr = (over: Partial<OrderQrCode> = {}): OrderQrCode => ({ orderItemId: "1", seq: 1, status: "PENDING", qrContent: "scan-key", pickupCode: "PM-1-01", receivedAt: null, pickupSessions: [session], receivedPickupSession: null, ...over });
const order = (items: OrderItem[], over: Partial<Order> = {}): Order => ({
  orderId: "9", orderNo: "ZT1", paymentStatus: "PAID", displayStatus: "PAID", fulfilmentStatus: "TO_SHIP", currency: "HKD", payableAmount: "120", paidAt: 1, items, ...over,
});

test("one card per QR record, with the code only while it can be collected", () => {
  const cards = pickupCards(order([item({ quantity: 2, qrCodes: [qr({ seq: 2 }), qr({ seq: 1, status: "RECEIVED", qrContent: null, pickupCode: null, receivedAt: 5, receivedPickupSession: session })] })]));
  assert.deepEqual(cards.map((c) => [c.key, c.piece, c.status, c.qrContent, c.pickupCode, c.receivedAt]), [
    ["1:1", "1／2", "RECEIVED", null, null, 5],
    ["1:2", "2／2", "PENDING", "scan-key", "PM-1-01", null],
  ]);
  assert.equal(cards[0].session?.name, "Fan meet pickup");
  assert.equal(cards[1].instruction, "Show the QR at the desk");
});

test("a bundle's pieces are named after the products in it, never the bundle", () => {
  const members = [
    { bundleItemId: "12", productId: "202", skuId: "0", productType: "SINGLE", title: "Poster", coverUrl: "p.png", specification: null, memberQuantity: 1, totalQuantity: 1 },
    { bundleItemId: "9", productId: "201", skuId: "0", productType: "SINGLE", title: "Tee", coverUrl: "tee.png", specification: "L / Black", memberQuantity: 1, totalQuantity: 1 },
  ];
  const bundle = item({ productType: "BUNDLE", title: "Fan set", specification: "Default", bundleItems: members, qrCodes: [qr({ seq: 1, bundleItemId: "9" }), qr({ seq: 2, bundleItemId: "12" })] });
  assert.deepEqual(pickupCards(order([bundle])).map((c) => [c.title, c.specification, c.coverUrl]), [["Tee", "L / Black", "tee.png"], ["Poster", null, "p.png"]]);
  // no records yet: still one code-less card per member
  assert.deepEqual(pickupCards(order([{ ...bundle, qrCodes: [] }])).map((c) => [c.title, c.status, c.qrContent]), [["Tee", "UNISSUED", null], ["Poster", "UNISSUED", null]]);
});

test("k／n counts what was bought, and a voided line becomes a cancelled card with no code", () => {
  assert.equal(pieceLabel(item({ quantity: 3 }), 2), "2／3");
  assert.equal(pieceLabel(item({ quantity: 2 }), 3), null);
  const voided = item({ orderItemId: "2", fulfilmentStatus: "CANCELLED", cancelReason: "Out of stock", qrCodes: [qr({ orderItemId: "2" })] });
  const o = order([item({ qrCodes: [qr()] }), voided]);
  assert.deepEqual(pickupCards(o).map((c) => c.key), ["1:1"]);
  assert.deepEqual(cancelledCards(o).map((c) => [c.key, c.reason]), [["cancelled:2", "Out of stock"]]);
  // a voided ORDER shows no scannable code even if a record still has one
  assert.equal(pickupCards({ ...o, fulfilmentStatus: "CANCELLED" })[0].qrContent, null);
});

test("cards group under their session, sessions in order, no-session last", () => {
  const later = { ...session, sessionId: "8", createdAt: 9, name: "Store" };
  const cards = pickupCards(order([item({ quantity: 3, qrCodes: [qr({ seq: 1, pickupSessions: [later] }), qr({ seq: 2 }), qr({ seq: 3, pickupSessions: [] })] })]));
  assert.deepEqual(groupBySession(cards).map((g) => [g.session?.name ?? null, g.cards.map((c) => c.key)]), [["Fan meet pickup", ["1:2"]], ["Store", ["1:1"]], [null, ["1:3"]]]);
});

test("the window prints one day compactly and stays null with no times", () => {
  assert.match(sessionWindow(session, "en-GB") ?? "", /^01\/09\/2026 \d\d:00–\d\d:00$/);
  assert.equal(sessionWindow({ startAt: null, endAt: null }, "en-GB"), null);
});

test("a paid pickup order reads awaiting pickup; a posted line keeps paid; partial progress only", () => {
  assert.equal(displayStatusKey(order([item()])), "AWAITING_PICKUP");
  assert.equal(displayStatusKey(order([item({ fulfillmentType: "SHIPPING" })])), "PAID");
  assert.equal(displayStatusKey(order([item()], { displayStatus: "COMPLETED" })), "COMPLETED");
  const fmt = (r: number, t: number) => `${r}/${t}`;
  assert.equal(pickupProgressText({ pickupProgress: { totalCount: 3, receivedCount: 1, pendingCount: 2 } }, fmt), "1/3");
  assert.equal(pickupProgressText({ pickupProgress: { totalCount: 3, receivedCount: 0, pendingCount: 3 } }, fmt), null);
  assert.equal(pickupProgressText({ pickupProgress: { totalCount: 3, receivedCount: 3, pendingCount: 0 } }, fmt), null);
});
