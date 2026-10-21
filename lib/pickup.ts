import type { Order, OrderItem, OrderPickupSession, OrderQrCode } from "./shop.ts";

/**
 * The order page's pickup cards, from `GET /creator/v1/orders/{orderId}`: the same rules Ztor's own
 * "My orders" draws (Ztor_WebV2 lib/eshop/orders.ts pickupCards), so a fan sees the same pickup on
 * both sites.
 *
 * ONE card per QR record — the server issues a record per physical piece (orderItemId + seq), so a
 * line bought as 3 is 3 cards and each is collected on its own. A bundle's record names the member
 * it is for (`bundleItemId`): the card reads that member, never the bundle's own name. A line with
 * no record yet still gets a code-less card (where and when to collect). A voided line gets a
 * cancelled card instead, whatever records it still carries.
 */

export type CardStatus = "PENDING" | "RECEIVED" | "EXPIRED" | "UNISSUED";

export type PickupCard = {
  key: string;
  title: string | null;
  specification: string | null;
  coverUrl: string | null;
  /** "2／3" after the name when the line (or member) was bought as several pieces. */
  piece: string | null;
  status: CardStatus;
  /** Only while the piece can still be collected (paid order, PENDING record, line not voided). */
  qrContent: string | null;
  pickupCode: string | null;
  receivedAt: number | null;
  /** The session the card is grouped under: where it was collected, else the first available one. */
  session: OrderPickupSession | null;
  instruction: string | null;
};

export type CancelledCard = { key: string; title: string | null; specification: string | null; coverUrl: string | null; quantity: number; cancelledAt: number | null; reason: string | null };

const VOIDED = new Set(["CANCELLED", "CANCEL_PENDING"]);
export const isVoided = (item: Pick<OrderItem, "fulfilmentStatus">) => VOIDED.has(item.fulfilmentStatus ?? "");

const text = (value: string | null | undefined) => value?.trim() || null;

/** Members in the server's numbering order (bundleItemId, numerically), each with its block of seq numbers. */
function membersInOrder(item: OrderItem) {
  const members = item.productType === "BUNDLE" ? item.bundleItems ?? [] : [];
  return [...members].sort((a, b) => a.bundleItemId.length - b.bundleItemId.length || (a.bundleItemId < b.bundleItemId ? -1 : a.bundleItemId > b.bundleItemId ? 1 : 0));
}

/**
 * k／n for a piece: n is what was BOUGHT, not how many records came back (a missing record must never
 * print 3／2). A bundle member counts within its own block of seq numbers. Nothing for a single piece.
 */
export function pieceLabel(item: OrderItem, seq: number, bundleItemId?: string | null): string | null {
  const members = membersInOrder(item);
  const member = bundleItemId ? members.find((m) => m.bundleItemId === bundleItemId) : undefined;
  let k = seq;
  let n = item.quantity;
  if (member) {
    k = seq - members.slice(0, members.indexOf(member)).reduce((sum, m) => sum + m.totalQuantity, 0);
    n = member.totalQuantity;
  } else if (members.length) {
    n = members.reduce((sum, m) => sum + m.totalQuantity, 0);
  }
  return n > 1 && k >= 1 && k <= n ? `${k}／${n}` : null;
}

export function pickupCards(order: Order): PickupCard[] {
  const items = order.items;
  const settled = order.paymentStatus !== undefined ? ["PAID", "NO_PAYMENT_REQUIRED"].includes(order.paymentStatus) : true;
  const orderVoided = VOIDED.has(order.fulfilmentStatus ?? "");
  const cards: { index: number; seq: number; card: PickupCard }[] = [];

  items.forEach((item, index) => {
    if (isVoided(item)) return;
    const records = (item.qrCodes ?? []).filter((qr) => qr.status !== "CANCELLED");
    if (records.length) {
      for (const qr of records) cards.push({ index, seq: qr.seq, card: fromRecord(item, qr, settled && !orderVoided) });
      return;
    }
    // No record issued yet: say where and when, with no code. A bundle lists its members.
    const members = membersInOrder(item);
    const sessionOf = (productId?: string, own?: OrderPickupSession[]) =>
      own?.[0] ?? item.pickup?.sessions.find((s) => !productId || (s as { productId?: string }).productId === productId) ?? item.pickupSessions?.[0] ?? null;
    const named = members.length
      ? members.map((m) => ({ key: `${item.orderItemId}:${m.bundleItemId}:unissued`, title: m.title, specification: m.specification, coverUrl: m.coverUrl, session: sessionOf(m.productId, m.pickupSessions) }))
      : [{ key: `${item.orderItemId}:unissued`, title: item.title, specification: item.specification, coverUrl: item.coverUrl, session: sessionOf(item.productId, item.pickupSessions) }];
    named.forEach((n, i) =>
      cards.push({
        index,
        seq: i + 1,
        card: { key: n.key, title: text(n.title), specification: text(n.specification), coverUrl: n.coverUrl, piece: null, status: "UNISSUED", qrContent: null, pickupCode: null, receivedAt: null, session: n.session, instruction: text(n.session?.instruction) ?? text(item.pickupInstruction) },
      }),
    );
  });

  return cards.sort((a, b) => a.index - b.index || a.seq - b.seq).map((c) => c.card);
}

function fromRecord(item: OrderItem, qr: OrderQrCode, collectable: boolean): PickupCard {
  const member = qr.bundleItemId ? item.bundleItems?.find((m) => m.bundleItemId === qr.bundleItemId) ?? null : null;
  const session = qr.status === "RECEIVED" ? qr.receivedPickupSession : qr.pickupSessions[0] ?? null;
  const live = collectable && qr.status === "PENDING" && !!qr.qrContent;
  return {
    key: `${qr.orderItemId}:${qr.seq}`,
    title: text(member?.title) ?? text(item.title),
    specification: text(member ? member.specification : item.specification),
    coverUrl: (member ? member.coverUrl : item.coverUrl) ?? null,
    piece: pieceLabel(item, qr.seq, member?.bundleItemId),
    status: qr.status === "CANCELLED" ? "EXPIRED" : qr.status,
    qrContent: live ? qr.qrContent : null,
    pickupCode: live ? text(qr.pickupCode) : null,
    receivedAt: qr.status === "RECEIVED" ? qr.receivedAt : null,
    session,
    instruction: text(session?.instruction) ?? text(item.pickupInstruction),
  };
}

export function cancelledCards(order: Order): CancelledCard[] {
  return order.items.filter(isVoided).map((item) => ({
    key: `cancelled:${item.orderItemId}`,
    title: text(item.title),
    specification: text(item.specification),
    coverUrl: item.coverUrl,
    quantity: item.quantity > 0 ? item.quantity : 1,
    cancelledAt: item.cancelledAt ?? null,
    reason: text(item.cancelReason),
  }));
}

/** Cards under one heading per session, in the sessions' own order (createdAt, then id); cards with no session last. */
export function groupBySession(cards: PickupCard[]): { session: OrderPickupSession | null; cards: PickupCard[] }[] {
  const groups = new Map<string, { session: OrderPickupSession | null; cards: PickupCard[] }>();
  for (const card of cards) {
    const key = card.session?.sessionId ?? "";
    const group = groups.get(key) ?? { session: card.session, cards: [] };
    group.cards.push(card);
    groups.set(key, group);
  }
  const byId = (a: string, b: string) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);
  return [...groups.values()].sort((a, b) => {
    if (!a.session || !b.session) return a.session ? -1 : b.session ? 1 : 0;
    const ca = a.session.createdAt ?? -1, cb = b.session.createdAt ?? -1;
    return ca === cb ? byId(a.session.sessionId, b.session.sessionId) : ca - cb;
  });
}

/** "2026/09/01 11:00–18:00" (same day) or "…–2026/09/02 18:00"; one end alone prints alone; null with neither. */
export function sessionWindow(session: Pick<OrderPickupSession, "startAt" | "endAt">, locale: string): string | null {
  const ok = (v: number | null | undefined): v is number => typeof v === "number" && v >= 0;
  const date = (ms: number) => new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
  const time = (ms: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  const { startAt, endAt } = session;
  if (ok(startAt) && ok(endAt)) return date(startAt) === date(endAt) ? `${date(startAt)} ${time(startAt)}–${time(endAt)}` : `${date(startAt)} ${time(startAt)}–${date(endAt)} ${time(endAt)}`;
  if (ok(startAt)) return `${date(startAt)} ${time(startAt)}`;
  if (ok(endAt)) return `${date(endAt)} ${time(endAt)}`;
  return null;
}

/**
 * The status for a PAID order still holding something to collect reads "awaiting pickup" (Ztor's My
 * orders, design 0930): every line here is collected at a counter; a line sent by post keeps "paid".
 */
export function displayStatusKey(order: Pick<Order, "displayStatus" | "items">): string {
  if (order.displayStatus !== "PAID") return order.displayStatus;
  const shipped = order.items.some((i) => i.fulfillmentType === "SHIPPING" || i.bundleItems?.some((m) => m.fulfillmentType === "SHIPPING"));
  return shipped ? "PAID" : "AWAITING_PICKUP";
}

/** "1 of 3 picked up" only while partial: none and all say themselves through the status. */
export function pickupProgressText(order: Pick<Order, "pickupProgress">, format: (received: number, total: number) => string): string | null {
  const p = order.pickupProgress;
  return p && p.receivedCount > 0 && p.receivedCount < p.totalCount ? format(p.receivedCount, p.totalCount) : null;
}
