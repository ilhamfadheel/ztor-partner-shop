// LLOUD's member store, now backed by Ztor: the signed-in fan (the shop's Ztor sign-in), their
// loyalty standing on the creator's board and the Media Vault (./ztor/state.js, loaded before a page
// renders). Same exports as LLOUD's preview store, so its pages and components read it unchanged.
// Points, tiers and unlocks are decided server-side; nothing here is an authorization boundary.
import * as state from './ztor/state.js';
import * as map from './ztor/map.js';
import { signInHref, signOut } from './ztor/session.js';

export const MEMBER_KEY = 'ztor_session';
export const DORMANT_MEMBER_KEY = 'lloud_member_dormant_preview_v1';
export const RETAIL_ORDERS_KEY = 'lisa_orders_v1';

export const TIERS = [
  { id: 'fan', name: 'Fan', level: 0, band: 'Everyone starts here', benefit: 'The collections. The community. Your first rewards.' },
  { id: 'ranked', name: 'Ranked Fan', level: 1, band: 'Next 30% of fans', benefit: 'More members-only pieces and gifts.' },
  { id: 'super', name: 'Super Fan', level: 2, band: 'Next 10% of fans', benefit: 'Rare releases and more to discover.' },
  { id: 'inner', name: 'Inner Circle', level: 3, band: 'Top 1% of fans', benefit: 'The closest circle. Exclusive auction access.' }
];

/** UI-only notes a page keeps for the fan in this browser (auction reminders): not points, not access. */
const LOCAL = ['notices'];
const localKey = () => (state.session() ? 'lloud_member_local_v1:' + state.session().user.sub : null);
const localNotes = () => {
  const key = localKey();
  try { return key ? JSON.parse(localStorage.getItem(key) ?? '{}') || {} : {}; } catch { return {}; }
};

export function member() {
  const who = state.member();
  const notes = localNotes();
  for (const field of LOCAL) if (Array.isArray(notes[field])) who[field] = notes[field].filter(v => typeof v === 'string');
  return who;
}

/** Keeps the UI-only notes of a patch for this fan; points, tier and access only change on Ztor. */
export function updateMember(patch = {}) {
  const key = localKey();
  if (key) {
    const notes = localNotes();
    for (const field of LOCAL) if (Array.isArray(patch[field])) notes[field] = [...new Set(patch[field].filter(v => typeof v === 'string'))];
    localStorage.setItem(key, JSON.stringify(notes));
  }
  document.dispatchEvent(new CustomEvent('member:change', { detail: { saved: true } }));
  return member();
}

export function resetPreview() { return member(); }

/** Saves the fan's profile on Ztor (name, bio, picture). */
export function saveProfile(patch) { return state.saveProfile(patch); }

/** Signs out of this site only, then back to the runway. */
export function signOutPreview() { return signOut('/'); }
/** Real sign-in: the hosted Ztor sign-in, back to where the fan was. */
export function signInPreview() { location.assign(signInHref(safeReturn(new URLSearchParams(location.search).get('return')))); }

export function tierOf(value = member().tier) { return TIERS.find(t => t.id === value) || TIERS[0]; }
export function tierForRank(rank, count) {
  if (!Number.isInteger(rank) || !Number.isInteger(count) || count < 1 || rank < 1 || rank > count) return TIERS[0];
  const percentile = rank / count;
  return TIERS[percentile <= .01 ? 3 : percentile <= .11 ? 2 : percentile <= .41 ? 1 : 0];
}
export function previewTier() { return member(); }

// ponytail: tier-gated eShop items are P2 (premium items for fans with enough points); until then
// every piece is open to everyone.
export const PRODUCT_ACCESS = {};
export function accessFor() {
  const required = TIERS[0];
  return { allowed: true, required, label: 'Open to everyone' };
}
export function canAuction(who = member()) { return !!who.id && who.tier === 'inner'; }

export const REWARDS = [];
export function rewardStatus(id, who = member()) {
  return map.rewardStatus(state.rewards().find(r => r.id === id), who);
}
export function rewardUnlocked(id, who = member()) { return rewardStatus(id, who).unlocked; }
/** Marks an unlocked reward as opened (its reveal has played) for this fan. */
export function claimReward(id) {
  if (!rewardUnlocked(id)) return false;
  state.markClaimed(id);
  return true;
}

// Orders, points for them and receipts are Ztor's now (the shop's checkout, then loyalty points).
export function readRetailOrders() { return []; }
export function recordOrder() {}

export function safeReturn(value, fallback = '/fan-club') {
  try {
    const url = new URL(value || fallback, location.href);
    // LLOUD's pages and the shop's own (orders, an order, notifications, the payment result).
    const allowed = /^\/(?:(?:|index|fan-club|loyalty|rewards|auction|leaderboard|account|edit-profile|shop|product|checkout)(?:\.html)?|orders(?:\/[\w-]+)?|notifications|checkout\/done)$/;
    if (url.origin !== location.origin || !allowed.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

// Another tab signed in or out: the page re-reads.
window.addEventListener('ztor-session', () => document.dispatchEvent(new CustomEvent('member:change')));
