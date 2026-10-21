// js/wishlist.js — port of Ztor assets/wishlist.js (ZtorWish).
//   localStorage 'lisa_wishlist_v1' = [{ id: <product slug>, addedAt }], newest first
//   document event 'wishlist:change' { detail: { type: 'add'|'remove'|'clear'|'sync', id } }

import { readJSON, writeJSON, storageFailure } from './util.js';

export const KEY = 'lisa_wishlist_v1';
export const EVENT = 'wishlist:change';

function hydrate() {
  const raw = readJSON(KEY, []);
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter(e => e && typeof e === 'object' && typeof e.id === 'string' && !seen.has(e.id) && seen.add(e.id))
    .map(e => ({ id: e.id, addedAt: Number(e.addedAt) || Date.now() }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

let entries = hydrate();

function commit(next, detail) {
  if (!writeJSON(KEY, next)) { storageFailure('Your wishlist could not be saved. Nothing changed. Please free some browser storage and try again.'); return false; }
  entries = next;
  document.dispatchEvent(new CustomEvent(EVENT, { detail }));
  return true;
}

export const wishlist = {
  list: () => entries.map(e => ({ ...e })),
  ids: () => entries.map(e => e.id),
  count: () => entries.length,
  has: id => entries.some(e => e.id === id),
  get(id) { const e = entries.find(x => x.id === id); return e ? { ...e } : null; },

  // add(id, addedAt): addedAt restores an undone removal to its ORIGINAL position ("as if nothing happened")
  add(id, addedAt) {
    if (!id || this.has(id)) return false;
    const next = [...entries, { id, addedAt: Number(addedAt) || Date.now() }].sort((a,b) => b.addedAt-a.addedAt);
    return commit(next, { type: 'add', id });
  },

  remove(id) {
    const next = entries.filter(e => e.id !== id);
    return next.length !== entries.length && commit(next, { type: 'remove', id });
  },

  // returns the NEW state (true = now wished)
  toggle(id) {
    if (this.has(id)) this.remove(id); else this.add(id);
    return this.has(id);
  },

  clear() {
    return commit([], { type: 'clear' });
  }
};

export function onWishlistChange(fn) {
  const handler = e => fn(e.detail || {}, wishlist);
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}

window.addEventListener('storage', e => {
  if (e.key === KEY) {
    entries = hydrate();
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { type: 'sync' } }));
  }
});
