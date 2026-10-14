/**
 * The words for a notification: the Creator API says what happened (`event`) and to which orders
 * and items; the site says it in its own voice, and links to the order.
 */
import type { ShopNotification } from "./shop.ts";

const TITLES: Record<string, string> = {
  "order-paid": "Payment received",
  "order-cancel-requested": "Your order is being cancelled",
  "order-cancelled": "Items cancelled",
  "order-picked-up": "Picked up",
  "order-completed": "Order complete",
  "payment-failed": "Payment didn't go through",
};

export function notificationText(n: ShopNotification): { title: string; detail: string; href: string } {
  if (n.event === "payment-failed") return { title: TITLES[n.event], detail: "The checkout expired before it was paid.", href: "/cart" };
  const orders = n.orders.map((o) => o.orderNo).filter(Boolean).join(", ");
  const items = n.orders
    .flatMap((o) => o.items)
    .map((i) => (i.quantity && i.quantity > 1 ? `${i.title} ×${i.quantity}` : i.title))
    .filter(Boolean)
    .join(", ");
  const orderId = n.orders.find((o) => o.orderId)?.orderId;
  const href = orderId ? `/orders/${encodeURIComponent(orderId)}` : "/orders";
  // Item changes lead with the items; whole-order ones with the order.
  const itemFirst = n.event === "order-cancelled" || n.event === "order-picked-up";
  const detail = itemFirst ? `${items} · order ${orders}` : n.event === "order-paid" ? `Order ${orders} · ${items}` : `Order ${orders}`;
  return { title: TITLES[n.event] ?? "Order update", detail, href };
}
