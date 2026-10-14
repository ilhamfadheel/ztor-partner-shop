import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationText } from "./notifications.ts";
import type { ShopNotification } from "./shop.ts";

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
  assert.deepEqual(notificationText(n("order-paid")), { title: "Payment received", detail: "Order O-1001 · Tour Tee ×2, Cap", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-cancel-requested")), { title: "Your order is being cancelled", detail: "Order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-cancelled", [cap])), { title: "Items cancelled", detail: "Cap · order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-picked-up", [{ ...tee, quantity: 1 }])), { title: "Picked up", detail: "Tour Tee · order O-1001", href: "/orders/1001" });
  assert.deepEqual(notificationText(n("order-completed")), { title: "Order complete", detail: "Order O-1001", href: "/orders/1001" });
});

test("a payment that didn't go through has no order to open, so it leads back to the bag", () => {
  assert.deepEqual(notificationText(n("payment-failed")), { title: "Payment didn't go through", detail: "The checkout expired before it was paid.", href: "/cart" });
});

test("an event this site doesn't know yet still reads sensibly", () => {
  assert.deepEqual(notificationText({ ...n("order-paid"), event: "order-shipped" as ShopNotification["event"] }), { title: "Order update", detail: "Order O-1001", href: "/orders/1001" });
});
