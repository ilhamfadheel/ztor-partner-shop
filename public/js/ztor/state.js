// What the LLOUD pages read, loaded from the Creator API before a page renders (hydrate), then held
// in memory so LLOUD's modules keep their synchronous reads (member(), rewardCatalog(), cart…).
// Changes go to the API first; the cache is reloaded and the page is told (member:change,
// cart:change), the events LLOUD's modules already listen to.
import { api, ApiError } from './api.js';
import { currentSession } from './session.js';
import * as map from './map.js';

const empty = () => ({ session: null, account: null, standing: null, rules: null, rewards: [], board: [], products: [], found: null, details: new Map(), lines: [], orders: [], down: new Set(), failed: new Set() });
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

/** `fn` over `items`, at most `size` at a time, results in order. */
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const LOADERS = {
  async member() {
    s.session = await currentSession();
    if (!s.session) { s.account = s.standing = null; return; }
    // Swapped in once read, so a background refresh never blanks what's on screen.
    let account = null, standing = null;
    await Promise.all([
      load('account', async () => { account = await api.account(); }),
      load('member', async () => { standing = await api.me(); }),
    ]);
    s.account = account;
    s.standing = standing;
  },
  vault: () => load('vault', async () => { s.rewards = map.toRewards(await api.eggs()); }),
  board: () => load('board', async () => { s.board = map.boardRows(await api.board(50)); }),
  rules: () => load('rules', async () => { s.rules = await api.rules(); }),
  products: () => load('products', async () => {
    const cards = (await api.products(1, 50)).items;
    // ponytail: the Creator API's cards carry no tags, so each piece's collection is read from its
    // detail (one request per card, a few at a time). Drop this once the cards carry their tags.
    const tags = await inBatches(cards, 6, c => api.product(c.productId).then(d => d?.tags ?? [], () => []));
    s.products = cards.map((c, i) => map.toProduct({ ...c, tags: tags[i] }));
  }),
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

// ── the tab's snapshot: the next page renders at once ─────────────────────────
// What a page loaded is kept for the tab (sessionStorage) under the fan it belongs to, so the next
// page — or the next view of this one — renders immediately from it; a part older than FRESH_MS is
// refreshed in the background and the page told (ztor:refresh). A different fan, or none, starts
// from nothing; signing out forgets it (session.js clearSession).
export const SNAPSHOT_KEY = 'lloud_state_v1';
const FRESH_MS = 30_000;
const FIELDS = { member: ['account', 'standing'], vault: ['rewards'], board: ['board'], rules: ['rules'], products: ['products'], cart: ['lines'], orders: ['orders'] };
const ownerOf = session => session?.user?.sub ?? null;
function readSnapshot() {
  try { return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) ?? 'null'); } catch { return null; }
}
function saveSnapshot(parts, at) {
  try {
    const owner = ownerOf(s.session);
    const prior = readSnapshot();
    const snap = prior && prior.owner === owner ? prior : { owner, at: {}, data: {} };
    for (const part of parts) {
      if (s.failed.has(part)) continue;
      snap.at[part] = at;
      for (const field of FIELDS[part]) snap.data[field] = s[field];
    }
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    // storage full or off: pages just load from the API
  }
}

/**
 * Loads what a page needs: from the tab's snapshot when it has it (at once; refreshed in the
 * background when older than FRESH_MS), else from the API, together.
 */
export async function hydrate(parts, { now = Date.now() } = {}) {
  s.session = await currentSession();
  const snap = readSnapshot();
  const mine = snap && snap.owner === ownerOf(s.session) ? snap : null;
  const cached = mine ? parts.filter(part => mine.at?.[part] && FIELDS[part].every(field => field in mine.data)) : [];
  for (const part of cached) for (const field of FIELDS[part]) s[field] = mine.data[field];
  const missing = parts.filter(part => !cached.includes(part));
  if (missing.length) {
    await Promise.all(missing.map(part => LOADERS[part]()));
    saveSnapshot(missing, now);
  }
  const stale = cached.filter(part => now - mine.at[part] >= FRESH_MS);
  if (stale.length) {
    void Promise.all(stale.map(part => LOADERS[part]())).then(() => {
      saveSnapshot(stale, Date.now());
      tell('ztor:refresh', { parts: stale });
    });
  }
}

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
/** The pieces matching a search, once search(q) has answered for that phrase; else null. */
export const found = q => (s.found?.q === q ? s.found.items : null);
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

/** Searches the shop's titles; each piece keeps the collection the shop already knows for it. */
export async function search(q) {
  await load('search', async () => {
    const items = (await api.products(1, 50, q)).items.map(map.toProduct);
    s.found = { q, items: items.map(p => ({ ...p, collection: product(p.slug)?.collection ?? null })) };
  });
}

/** One product's detail (options, SKUs, gallery), cached for the page. */
export async function loadDetail(id) {
  if (!s.details.has(id)) s.details.set(id, await api.product(id));
  return s.details.get(id);
}

async function reloadCart(detail) {
  s.lines = map.toCartLines(await api.cart());
  saveSnapshot(['cart'], Date.now());
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
  saveSnapshot(['member'], Date.now());
  tell('member:change', { saved: true });
  return s.account;
}
export async function saveAvatar(file) {
  s.account = await api.uploadAvatar(file);
  saveSnapshot(['member'], Date.now());
  tell('member:change', { saved: true });
  return s.account;
}
