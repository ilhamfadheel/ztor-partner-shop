/**
 * The words for a notification: the Creator API says what happened (`event`) and to which orders
 * and items; the site says it in its own voice — in the fan's language — and links to the order.
 * A `broadcast` is the platform's own message to its fans, shown as written.
 */
import type { Messages } from "./i18n.ts";
import type { ShopNotification } from "./shop.ts";

export function notificationText(n: ShopNotification, t: Messages): { title: string; detail: string; href: string } {
  const w = t.notifications;
  // The platform's message to its fans: its own words, read in place on the notifications page.
  if (n.event === "broadcast") return { title: n.message?.subject || w.message, detail: n.message?.body ?? "", href: "/notifications" };
  if (n.event === "payment-failed") return { title: w.titles[n.event], detail: w.checkoutExpired, href: "/cart" };
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
  const detail = itemFirst ? w.itemsOfOrder(items, orders) : n.event === "order-paid" ? w.orderWithItems(orders, items) : w.orderOnly(orders);
  return { title: w.titles[n.event] ?? w.orderUpdate, detail, href };
}
