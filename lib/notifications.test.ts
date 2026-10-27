import assert from "node:assert/strict";
import { test } from "node:test";
import { dict } from "./i18n.ts";
import { notificationText } from "./notifications.ts";
import type { ShopNotification } from "./shop.ts";

const en = dict("en-us");
const tee = { orderItemId: "11", title: "Tour Tee", quantity: 2 };
const cap = { orderItemId: "12", title: "Cap", quantity: 1 };
const n = (event: ShopNotification["event"], items = [tee, cap]): ShopNotification => ({
  notificationId: "1",
  event,
  checkoutGroupId: "g-1",
  orders: event === "payment-failed" ? [] : [{ orderId: "1001", orderNo: "O-1001", shopName: "Trip Cast", items }],
  createdAt: 0,
  readAt: null,
});

test("each event reads as what happened, naming the order and the items, and opens the order", () => {
  assert.deepEqual(notificationText(n("order-paid"), en), { title: "Payment received", detail: "Order O-1001 · Tour Tee ×2, Cap", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-cancel-requested"), en), { title: "Your order is being cancelled", detail: "Order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-cancelled", [cap]), en), { title: "Items cancelled", detail: "Cap · order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-picked-up", [{ ...tee, quantity: 1 }]), en), { title: "Picked up", detail: "Tour Tee · order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-completed"), en), { title: "Order complete", detail: "Order O-1001", href: "/orders/1001" });
});

test("a payment that didn't go through has no order to open, so it leads back to the bag", () => {
  assert.deepEqual(notificationText(n("payment-failed"), en), { title: "Payment didn't go through", detail: "The checkout expired before it was paid.", href: "/cart" });
});

test("an event this site doesn't know yet still reads sensibly", () => {
  assert.deepEqual(notificationText({ ...n("order-paid"), event: "order-shipped" as ShopNotification["event"] }, en), { title: "Order update", detail: "Order O-1001", href: "/orders/1001" });
});

test("the fan's language carries into the notification, order number and all", () => {
  assert.deepEqual(notificationText(n("order-paid"), dict("zh-hk")), { title: "已收到付款", detail: "訂單 O-1001 · Tour Tee ×2, Cap", href: "/orders/1001" });
  assert.equal(notificationText(n("payment-failed"), dict("zh-cn")).title, "支付未完成");
});

test("a message from the platform reads as its subject and body, and stays on the notifications", () => {
  const msg: ShopNotification = {
    notificationId: "9",
    event: "broadcast",
    checkoutGroupId: "broadcast:4",
    orders: [],
    message: { broadcastId: "4", subject: "Early access for Inner Circle", body: "Hi Ana,\nthe drop opens Friday." },
    createdAt: 0,
    readAt: null,
  };
  assert.deepEqual(notificationText(msg, en), { title: "Early access for Inner Circle", detail: "Hi Ana,\nthe drop opens Friday.", href: "/notifications" });
  assert.equal(notificationText({ ...msg, message: null }, en).title, "Message");
});
