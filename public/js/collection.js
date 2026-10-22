// js/collection.js — the active collection (world).
// Resolution: ?collection= > localStorage['lisa.collection'] > rockstar.
// Applies data-collection to <html> (document.documentElement) — the shell's [data-collection] rules
// set the --c-* tokens there and every .l-world rides the 900ms transition. Dispatches 'collection:change'.
// NOTE: js/collection-boot.js (classic, in <head>) stamps the same attribute pre-paint; this module is the API.

import { COLLECTIONS, COLLECTION_IDS, DEFAULT_COLLECTION, getCollection as lookup, getProduct } from './data.js';
import { readString, writeString } from './util.js';

export const STORAGE_KEY = 'lisa.collection';
export const EVENT = 'collection:change';

const root = document.documentElement;
const valid = id => COLLECTION_IDS.includes(id);

function fromQuery() {
  try { return new URLSearchParams(location.search).get('collection'); } catch (e) { return null; }
}

function productCollection() {
  if (root.getAttribute('data-page') !== 'product') return null;
  try { return getProduct(new URLSearchParams(location.search).get('id'))?.collection || null; } catch (e) { return null; }
}

// A product URL owns its color; browsing-history defaults apply to other pages.
export function resolveCollection() {
  const product = productCollection();
  if (product) return product;
  const q = fromQuery();
  if (valid(q)) return q;
  const s = readString(STORAGE_KEY);
  if (valid(s)) return s;
  return DEFAULT_COLLECTION;
}

// what the page currently wears (falls back to resolution if the boot script did not run)
export function getCollection() {
  const attr = root.getAttribute('data-collection');
  return valid(attr) ? attr : resolveCollection();
}

export function collectionData(id = getCollection()) {
  return lookup(id) || lookup(DEFAULT_COLLECTION);
}

export function setCollection(id, { persist = true, silent = false } = {}) {
  if (!valid(id)) return getCollection();
  const prev = root.getAttribute('data-collection');
  root.setAttribute('data-collection', id);
  if (persist) writeString(STORAGE_KEY, id);
  if (!silent && prev !== id) {
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { id, previous: prev, collection: collectionData(id) } }));
  }
  return id;
}

// call once per page (site.js does): reconciles the attribute with the resolution and persists a
// ?collection= choice so every other page opens in that world.
export function initCollection() {
  // The runway's synchronous entry boot already resolved hash vs. sheet query.
  // Do not overwrite that first paint with a previous browsing-history world.
  const id = document.querySelector('.showroom') ? getCollection() : resolveCollection();
  const attr = root.getAttribute('data-collection');
  if (attr !== id) root.setAttribute('data-collection', id);
  // A product page wears its piece's world (its id, or the ?collection= its shop link carries) without keeping it.
  if (root.getAttribute('data-page') !== 'product' && valid(fromQuery())) writeString(STORAGE_KEY, id);
  return id;
}

export function onCollectionChange(fn) {
  const handler = e => fn(e.detail.id, e.detail);
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}

export function cycleCollection(step = 1) {
  const i = COLLECTION_IDS.indexOf(getCollection());
  const next = COLLECTION_IDS[(i + step + COLLECTION_IDS.length) % COLLECTION_IDS.length];
  return setCollection(next);
}

export { COLLECTIONS, COLLECTION_IDS, DEFAULT_COLLECTION };

// another tab switched the world: follow it (persist=false — it is already stored)
window.addEventListener('storage', e => {
  if (productCollection()) return;
  if (e.key === STORAGE_KEY && valid(e.newValue) && e.newValue !== getCollection()) {
    setCollection(e.newValue, { persist: false });
  }
});
