// The shop's rules for the LLOUD commerce pages (product, bag, checkout), as pure functions: option
// picks → one SKU, what can still be bought, prices and caps, the bag's totals, and the checkout
// request. Same rules as the React pages they replace (components/AddToCart.tsx, app/cart,
// app/checkout, lib/availability.ts, lib/media.ts). No fetch, no DOM; storage only where named.
import config from '/lloud-config.js';
import { mediaUrl, money } from './map.js';

/** The bag's ceiling for one line, whatever the product allows. */
export const MAX_QTY = 99;

/** Ztor's rule (lib/availability.ts): sold out when not sellable, or no stock left. */
export const isSoldOut = item => !item?.sellable || item.stockQuantity === 0;

const has = (sku, optionId, valueId) => sku.selectedOptions.some(so => so.optionId === optionId && so.optionValueId === valueId);

/** The SKU for the picked values: only once every option has one. A product without options is its only SKU. */
export function resolveSku(detail, picked) {
  if (!detail?.skus?.length) return null;
  if (!detail.options.length) return detail.skus[0];
  if (detail.options.some(o => !picked[o.optionId])) return null;
  return detail.skus.find(s => detail.options.every(o => has(s, o.optionId, picked[o.optionId]))) ?? null;
}

/** Whether some buyable SKU carries this value together with the values picked for the OTHER options. */
export function valueAvailable(detail, picked, optionId, valueId) {
  return detail.skus.some(s => !isSoldOut(s) && has(s, optionId, valueId) && detail.options.every(o => o.optionId === optionId || !picked[o.optionId] || has(s, o.optionId, picked[o.optionId])));
}

/** Picks a value; the other picks it can't be bought with are dropped (the fan re-chooses those). */
export function pickValue(detail, picked, optionId, valueId) {
  const next = { ...picked, [optionId]: valueId };
  for (const o of detail.options) {
    if (o.optionId !== optionId && next[o.optionId] && !valueAvailable(detail, next, o.optionId, next[o.optionId])) delete next[o.optionId];
  }
  return next;
}

/** An option with a single (buyable) value has nothing to choose: it starts picked. */
export function initialPicks(detail) {
  const picked = {};
  for (const o of detail?.options ?? []) {
    if (o.values.length === 1 && valueAvailable(detail, picked, o.optionId, o.values[0].optionValueId)) picked[o.optionId] = o.values[0].optionValueId;
  }
  return picked;
}

/** The first option still waiting for a value, or null. */
export const firstMissing = (detail, picked) => detail.options.find(o => !picked[o.optionId])?.optionId ?? null;

/** The price line: the product's range until a SKU is picked, then the SKU's own (and its original when discounted). */
export function priceOf(detail, sku) {
  const currency = detail.currency;
  if (sku) return { now: money(sku.effectivePrice, currency), was: sku.originalPrice && sku.originalPrice > sku.effectivePrice ? money(sku.originalPrice, currency) : null };
  const now = detail.minPrice === detail.maxPrice ? money(detail.minPrice, currency) : `${money(detail.minPrice, currency)} – ${money(detail.maxPrice, currency)}`;
  return { now, was: null };
}

/** How many one fan may add: the purchase limit, the picked SKU's stock and the bag's ceiling. */
export function qtyCap(detail, sku) {
  const stock = sku?.stockQuantity;
  return Math.max(1, Math.min(MAX_QTY, detail?.purchaseLimit || MAX_QTY, stock == null ? MAX_QTY : stock));
}

const VIDEO_FILE = /\.(mp4|m4v|mov|webm|m3u8)$/i;

/** A video, read off the path only (lib/media.ts): its file type or Merchandise's `video/` folder. */
export function isVideoUrl(src) {
  const url = mediaUrl(src);
  if (!url) return false;
  const path = new URL(url).pathname;
  return VIDEO_FILE.test(path) || /^\/video\//i.test(path);
}

/** The product's gallery in the seller's order, absolute URLs, videos marked, unusable entries dropped. */
export function galleryItems(media = []) {
  return [...media]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(m => ({ type: m.type === 'VIDEO' || isVideoUrl(m.url) ? 'VIDEO' : 'IMAGE', url: mediaUrl(m.url) }))
    .filter(m => m.url);
}

/** How the product reaches the fan: shipped, or collected at the pickup session still open (else the first). */
export function fulfilmentText(detail) {
  if (detail?.fulfillmentType === 'SHIPPING') return 'Ships to you';
  if (detail?.fulfillmentType !== 'QR_PICKUP') return '';
  const sessions = detail.pickup?.sessions ?? [];
  const shown = sessions.find(s => s.statusCode !== 'ENDED') ?? sessions[0];
  if (!shown) return 'Pickup with a QR code';
  const more = sessions.length > 1 ? ` (+${sessions.length - 1} more)` : '';
  return 'Pickup at ' + [shown.name, shown.location].filter(Boolean).join(', ') + more;
}

// ── the bag ──────────────────────────────────────────────────────────────────
const buyable = line => line.status === 'AVAILABLE';

/** The bag lines that can be paid for now (the rest stay in the bag, left out of checkout). */
export const payableLineIds = lines => lines.filter(buyable).map(l => l.id);

/** The bag's money: the subtotal of its buyable lines. Delivery and discounts are the checkout quote's. */
export function bagTotals(lines) {
  const payable = lines.filter(buyable);
  const subtotal = payable.reduce((n, l) => n + l.price * l.qty, 0);
  return {
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal,
    currency: (payable[0] ?? lines[0])?.currency ?? 'HKD',
    shipping: 0,
    tax: 0,
    discount: 0,
    total: subtotal,
    note: 'Delivery and any discounts are calculated at checkout',
  };
}

/** A line's status for the fan ("Sold out"); nothing for a buyable line. */
export function lineStatusText(status) {
  if (!status || status === 'AVAILABLE') return '';
  const words = String(status).replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── checkout ─────────────────────────────────────────────────────────────────
/** Where checkout keeps the group it started, for /checkout/done. */
export const PENDING_GROUP = 'ztor_pending_group';
export const NEW_CONTACT = 'new';

/** What's missing from a new pickup contact, by field. */
export function contactErrors({ name = '', phone = '' } = {}) {
  const errors = {};
  if (!String(name).trim()) errors.name = 'Enter the name of whoever collects the order.';
  if (!String(phone).trim()) errors.phone = 'Enter a phone number we can reach them on.';
  return errors;
}

/** The POST /checkout body: the quoted lines, the method, the quote's hash, where payment returns, and the pickup contact. */
export function checkoutBody({ lineIds, method, quote, contactId, contact, origin }) {
  const pickup = contactId === NEW_CONTACT || !contactId
    ? { pickup_contact: { name: String(contact?.name ?? '').trim(), phone: String(contact?.phone ?? '').trim() } }
    : { pickup_contact_id: contactId };
  return { cart_item_ids: [...lineIds], payment_method: method, confirmation_hash: quote.confirmationHash, callback_url: `${origin}/checkout/done`, ...pickup };
}

/** Where the fan goes once checkout started: the payment page when one is required (https only), else the result page. */
export const afterCheckout = submission =>
  submission?.paymentAction === 'ACTION_REQUIRED' && /^https:\/\//.test(submission.paymentUrl ?? '') ? submission.paymentUrl : '/checkout/done';

/** The method to start on: the remembered one while the shop still offers it, else the first. */
export const preferredMethod = (methods, saved) => (methods.find(m => m.methodCode === saved) ?? methods[0])?.methodCode ?? '';

// The fan's preferred payment method on this site, per platform (lib/preferences.ts).
const preferenceKey = () => `ztor.preferred_payment:${config.clientId}`;
export function savedPayment() {
  try { return localStorage.getItem(preferenceKey()); } catch { return null; }
}
export function savePayment(methodCode) {
  try {
    if (methodCode) localStorage.setItem(preferenceKey(), methodCode);
    else localStorage.removeItem(preferenceKey());
  } catch {
    // storage off: the choice just isn't remembered
  }
}
