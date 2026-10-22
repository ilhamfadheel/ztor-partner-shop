// js/cart.js — LLOUD's bag API, backed by the fan's Ztor cart (ztor/state.js holds it in memory,
// hydrated before the page renders). Reads stay synchronous; changes go to the Creator API and
// return promises, then state.js reloads the bag and fires 'cart:change' on document.
//   line = { id (= cartItemId), slug (= productId), skuId, size (SKU label), colour, title, price, currency, image, qty, max, status }
//   document event 'cart:change' { detail: { type: 'add'|'qty'|'remove'|'clear'|'sync'|'membership', id } }
// The bag shows the subtotal of its buyable lines only: delivery and discounts are the checkout quote's.
// A signed-out fan who adds to the bag is sent to the Ztor sign-in, and comes back to this page.

import * as state from './ztor/state.js';
import { signInHref } from './ztor/session.js';
import { bagTotals, MAX_QTY as BAG_MAX } from './ztor/commerce.js';

/** Kept for importers from the prototype: the bag no longer lives in localStorage. */
export const KEY = 'lisa_cart_v1';
export const CURRENCY = 'HKD';
export const EVENT = 'cart:change';
export const MAX_QTY = BAG_MAX;   // one ceiling for every path; a line's own `max` (purchase limit / stock) comes first

/** Delivery and promotions are decided by the shop at checkout; the bag invents none. */
export const SHIP_METHODS = Object.freeze([]);
export const PROMOS = Object.freeze({});

const items = () => state.lines();

/** The bag line holding this product's SKU, or the id a new line would be looked up by. */
export function lineId(slug, skuId) {
  return items().find(it => it.slug === slug && it.skuId === skuId)?.id ?? slug + '|' + (skuId || '');
}

function signedOut() {
  if (state.session()) return false;
  location.assign(signInHref(location.pathname + location.search));
  return true;
}

export const cart = {
  getItems: () => items(),
  count: () => items().reduce((n, it) => n + it.qty, 0),
  lineCount: () => items().length,
  subtotal: () => bagTotals(items()).subtotal,
  currency: () => bagTotals(items()).currency,
  has: id => items().some(it => it.id === id),
  get(id) { return items().find(x => x.id === id) ?? null; },
  qtyOf(id) { return items().find(x => x.id === id)?.qty ?? 0; },

  /** Adds `qty` of a product's SKU: { slug | productId, skuId, qty }. Resolves to the cart line id, or null when signed out. */
  async add(p) {
    const productId = p?.productId ?? p?.slug;
    if (!productId || !p.skuId) return null;
    if (signedOut()) return null;
    const qty = Math.min(MAX_QTY, Math.max(1, parseInt(p.qty, 10) || 1));
    return state.addToCart(productId, p.skuId, qty);
  },

  addProduct(productId, skuId, qty = 1) {
    return this.add({ productId, skuId, qty });
  },

  async setQty(id, qty) {
    const n = parseInt(qty, 10) || 0;
    const line = this.get(id);
    if (!line) return false;
    if (n <= 0) return this.remove(id);
    await state.setQty(id, Math.min(line.max || MAX_QTY, MAX_QTY, n));
    return true;
  },

  async remove(id) {
    if (!this.has(id)) return false;
    await state.removeLine(id);
    return true;
  },

  async clear() {
    for (const it of items()) await state.removeLine(it.id);
    return true;
  },

  /** The bag's money: subtotal of the buyable lines; shipping/tax/discount are 0 here (the checkout quote has them). */
  totals() {
    const t = bagTotals(items());
    return { ...t, discountLabel: '', free: false };
  }
};

export function onCartChange(fn) {
  const handler = e => fn(e.detail || {}, cart);
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}

/** The prototype's checkout maths, now only the bag's honest totals (the quote is the authority at checkout). */
export const checkout = {
  SHIP_METHODS, PROMOS,
  totals(subtotal = cart.subtotal()) {
    return { subtotal, discount: 0, discountLabel: '', shipping: 0, tax: 0, total: subtotal, note: bagTotals([]).note };
  },
  ready: (...parts) => parts.every(Boolean)
};

// The bag may have changed in another tab or on Ztor itself: re-read it when the fan comes back to this one.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.session()) return;
    state.hydrate(['cart']).then(() => document.dispatchEvent(new CustomEvent(EVENT, { detail: { type: 'sync' } })));
  });
  document.addEventListener('member:change', () => document.dispatchEvent(new CustomEvent(EVENT, { detail: { type: 'membership' } })));
}
