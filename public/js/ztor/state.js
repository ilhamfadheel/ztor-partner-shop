// What the LLOUD pages read, loaded from the Creator API before a page renders (hydrate), then held
// in memory so LLOUD's modules keep their synchronous reads (member(), rewardCatalog(), cart…).
// Changes go to the API first; the cache is reloaded and the page is told (member:change,
// cart:change), the events LLOUD's modules already listen to.
import { api, ApiError } from './api.js';
import { currentSession } from './session.js';
import * as map from './map.js';

const empty = () => ({ session: null, account: null, standing: null, rules: null, rewards: [], board: [], products: [], details: new Map(), lines: [], orders: [], down: new Set(), failed: new Set() });
let s = empty();

/** For tests: forget everything loaded. */
export const forget = () => { s = empty(); };

/** True when that part of the API answered "not here" (not deployed yet on this gateway). */
export const unavailable = part => s.down.has(part);
/** True when that part failed to load this time (unavailable, refused or unreachable). */
export const failed = part => s.failed.has(part);

/** Loads a part; a refusal leaves it empty. An unknown route marks it unavailable; sign-in trouble ends nothing here. */
async function load(part, fn) {
  try {
    await fn();
    s.down.delete(part);
    s.failed.delete(part);
  } catch (error) {
    s.failed.add(part);
    if (error instanceof ApiError && error.code === 'UNAVAILABLE') s.down.add(part);
    else console.warn(`LLOUD: ${part} could not load`, error);
  }
}

const LOADERS = {
  async member() {
    s.session = await currentSession();
    s.account = s.standing = null;
    if (!s.session) return;
    await Promise.all([
      load('account', async () => { s.account = await api.account(); }),
      load('member', async () => { s.standing = await api.me(); }),
    ]);
  },
  vault: () => load('vault', async () => { s.rewards = map.toRewards(await api.eggs()); }),
  board: () => load('board', async () => { s.board = map.boardRows(await api.board(50)); }),
  rules: () => load('rules', async () => { s.rules = await api.rules(); }),
  products: () => load('products', async () => { s.products = (await api.products(1, 50)).items.map(map.toProduct); }),
  async cart() {
    s.session ??= await currentSession();
    if (!s.session) { s.lines = []; return; }
    await load('cart', async () => { s.lines = map.toCartLines(await api.cart()); });
  },
  async orders() {
    s.session ??= await currentSession();
    if (!s.session) { s.orders = []; return; }
    await load('orders', async () => { s.orders = (await api.orders(1)).items ?? []; });
  },
};

/** Loads what a page needs, together. */
export const hydrate = (parts) => Promise.all(parts.map(part => LOADERS[part]()));

// ── synchronous reads ────────────────────────────────────────────────────────
const claimedKey = () => (s.session ? 'lloud_claimed_v1:' + s.session.user.sub : null);
const claimedList = () => {
  const key = claimedKey();
  if (!key) return [];
  try { const list = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(list) ? list.filter(v => typeof v === 'string') : []; } catch { return []; }
};

export const session = () => s.session;
export const account = () => s.account;
export const member = () => map.toMember({ session: s.session, account: s.account, standing: s.standing, claimed: claimedList(), unlocked: s.session ? s.rewards.filter(r => r.unlocked).map(r => r.id) : [] });
export const rewards = () => s.rewards;
export const board = () => s.board;
export const rules = () => s.rules;
export const products = () => s.products;
export const product = id => s.products.find(p => p.slug === id) ?? null;
export const detail = id => s.details.get(id) ?? null;
export const lines = () => s.lines.map(line => ({ ...line }));
export const orders = () => s.orders;

/** "Opened" is the reveal having played once: a look-and-feel note kept in this browser, per fan. */
export function markClaimed(id) {
  const key = claimedKey();
  if (!key) return false;
  const list = claimedList();
  if (!list.includes(id)) localStorage.setItem(key, JSON.stringify([...list, id]));
  return true;
}

// ── changes ──────────────────────────────────────────────────────────────────
const tell = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));

/** One product's detail (options, SKUs, gallery), cached for the page. */
export async function loadDetail(id) {
  if (!s.details.has(id)) s.details.set(id, await api.product(id));
  return s.details.get(id);
}

async function reloadCart(detail) {
  s.lines = map.toCartLines(await api.cart());
  tell('cart:change', detail);
}

export async function addToCart(productId, skuId, qty) {
  const added = await api.addToCart(productId, skuId, qty);
  await reloadCart({ type: 'add', id: added?.cartItemId ?? null });
  return added?.cartItemId ?? null;
}
export async function setQty(cartItemId, qty) {
  if (qty <= 0) return removeLine(cartItemId);
  await api.setQty(cartItemId, qty);
  await reloadCart({ type: 'qty', id: cartItemId });
}
export async function removeLine(cartItemId) {
  await api.removeLine(cartItemId);
  await reloadCart({ type: 'remove', id: cartItemId });
}

/** A profile change on Ztor; the member is re-read and the page told. */
export async function saveProfile(patch) {
  s.account = await api.updateAccount(patch);
  tell('member:change', { saved: true });
  return s.account;
}
export async function saveAvatar(file) {
  s.account = await api.uploadAvatar(file);
  tell('member:change', { saved: true });
  return s.account;
}
