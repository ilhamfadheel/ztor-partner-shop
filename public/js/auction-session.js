// DEMO ONLY: localStorage contains private auction state. A browser cannot secure
// bids, eligibility, clocks or settlement. Production requires a trusted server.
import { createAuction, placeOpenBid, closeOpenRound, placeSealedBid, closeSealedRound, publicView } from './auction-engine.js';
import { member, canAuction } from './member-store.js';
import { AUCTION_LOTS, auctionLot, currentAuctionLot } from './auction-catalog.js';
import { t } from './i18n.js';

const KEY = 'lloud_auction_preview_v1';
const MINUTE = 60_000;
const SCENARIOS = ['announced', 'open', 'sealed', 'tie', 'won', 'lost', 'excluded', 'no-sale'];
const YOU = 'preview-you';
const others = Array.from({ length: 11 }, (_, i) => `preview-fan-${i + 1}`);
const sessions = new Map();
const storageKey = id => KEY + (id === 'encore' ? '' : '_' + id);
const lotFor = id => { const lot = auctionLot(id); if (!lot) throw new Error('Unknown auction lot'); return lot; };
const clock = value => Math.max(Date.now() + value.offset, value.state.lastActionAt);
const emit = lotId => document.dispatchEvent(new CustomEvent('auction:change', {detail:{lotId}}));

function seed(name, lotId) {
  if (!SCENARIOS.includes(name)) throw new Error('Unknown auction scenario');
  const lot = lotFor(lotId);
  let now = Date.now();
  let state = createAuction({ id: lot.auctionId, openingPrice:lot.openingPrice, opensAt: now + (name === 'announced' ? 10 * MINUTE : 0),
    openEndsAt: now + (name === 'announced' ? 40 : 30) * MINUTE, sealedDurationMs: 15 * MINUTE,
    eligibleIds: [YOU, ...others] });
  if (name !== 'announced' && name !== 'no-sale') {
    const people = name === 'excluded' ? [YOU, ...others] : [...others, YOU];
    people.forEach((userId, i) => { state = placeOpenBid(state, { userId, amount: lot.openingPrice + i * 300, now }); });
  }
  if (!['announced', 'open'].includes(name)) {
    now = state.openEndsAt;
    state = closeOpenRound(state, { now });
  }
  if (['tie', 'won', 'lost'].includes(name)) {
    const opponent = state.participantIds.find(id => id !== YOU);
    state = placeSealedBid(state, { userId: YOU, amount: state.floor + 1000, now });
    state = placeSealedBid(state, { userId: opponent, amount: state.floor + (name === 'won' ? 500 : name === 'lost' ? 1500 : 1000), now });
    now = state.roundEndsAt;
    state = closeSealedRound(state, { now });
  }
  return { version: 1, demo: true, scenario: name, offset: now - Date.now(), state };
}

function load(lotId) {
  const lot = lotFor(lotId);
  if (sessions.has(lotId)) return sessions.get(lotId);
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(lotId)));
    const s = value?.state;
    if (value?.version === 1 && value.demo === true && SCENARIOS.includes(value.scenario) && Number.isSafeInteger(value.offset)
      && s?.id === lot.auctionId && ['announced', 'open', 'sealed', 'tie', 'settled', 'no-sale', 'review'].includes(s.stage)
      && ['eligibleIds', 'openBids', 'participantIds', 'sealedBids'].every(k => Array.isArray(s[k]))
      && ['opensAt', 'openEndsAt', 'lastActionAt', 'sealedDurationMs', 'floor'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0)
      && (!['sealed', 'tie'].includes(s.stage) || Number.isSafeInteger(s.roundEndsAt))) {
      publicView(s, null, clock(value));
      sessions.set(lotId, value);
    }
  } catch { /* Corrupt/unavailable storage falls back to an in-memory preview. */ }
  if (!sessions.has(lotId)) {
    const value = seed(lot.scenario, lotId);
    sessions.set(lotId, value);
    // Persist the initial clock too; merely revisiting must not reset a lot's deadline.
    try { localStorage.setItem(storageKey(lotId), JSON.stringify(value)); } catch { /* Read-only preview still renders. */ }
  }
  return sessions.get(lotId);
}

function save(value, lotId) {
  // Commit memory only after durable write succeeds; callers never get false success.
  try { localStorage.setItem(storageKey(lotId), JSON.stringify(value)); }
  catch { throw new Error(t('Preview could not be saved')); }
  sessions.set(lotId, value);
  emit(lotId);
  return auctionSnapshot(lotId);
}

export function auctionSnapshot(lotId = currentAuctionLot().id) {
  const value = load(lotId);
  const now = clock(value);
  const who = member();
  const userId = canAuction(who) ? who.id : null;
  const view = publicView(value.state, userId, now);
  // Participation belongs to the signed-in identity, not its current bidding tier.
  // Only a boolean crosses this boundary; no other bidder's hidden activity leaks.
  const participated = !!who.id && value.state.openBids.some(bid => bid.userId === who.id);
  return { ...view, lotId, userId, now, demo: true, scenario: value.scenario, participated,
    ...(['announced', 'open'].includes(view.stage) ? { publicBids: value.state.openBids.map(({ userId, amount }) => ({ userId, amount })) } : {}) };
}

export function submitAuctionBid(amount, lotId = currentAuctionLot().id, reviewed = null) {
  const who = member();
  if (!canAuction(who)) throw new Error(t('Inner Circle eligibility required'));
  const current = tickAuction(lotId);
  // Check AFTER ticking: a deadline can advance to a new tie round during review.
  // The amount must never accidentally become a bid in that different round.
  if (reviewed && (reviewed.userId !== who.id || reviewed.stage !== current.stage ||
    reviewed.round !== current.round || reviewed.floor !== current.floor ||
    reviewed.revision !== (current.ownBid?.revision || 0))) {
    throw new Error(t('The bid or round changed. Close this review and confirm the current details.'));
  }
  const value = load(lotId);
  const now = clock(value);
  const bid = { userId: who.id, amount, now };
  const state = ['sealed', 'tie'].includes(value.state.stage)
    ? placeSealedBid(value.state, bid) : placeOpenBid(value.state, bid);
  return save({ ...value, state }, lotId);
}

export function setAuctionScenario(name, lotId = currentAuctionLot().id) { return save(seed(name, lotId), lotId); }

export function tickAuction(lotId = currentAuctionLot().id) {
  const value = load(lotId);
  const now = clock(value);
  let state = value.state;
  if (['announced', 'open'].includes(state.stage) && now >= state.openEndsAt) state = closeOpenRound(state, { now: state.openEndsAt });
  // Close at the actual deadline: a reload must not grant another full round.
  while (['sealed', 'tie'].includes(state.stage) && now >= state.roundEndsAt) {
    state = closeSealedRound(state, { now: state.roundEndsAt });
  }
  if (state !== value.state) return save({ ...value, state }, lotId);
  if (state.stage === 'announced' && now >= state.opensAt) return save({ ...value, state: { ...state, stage: 'open' } }, lotId);
  return auctionSnapshot(lotId);
}

// Developer preview control only. Advances a persisted logical clock; wall time
// continues normally afterward. Never expose this as a fan bidding action.
export function advanceAuction(outcome = 'normal', lotId = currentAuctionLot().id) {
  if (!['normal', 'tie', 'lose'].includes(outcome)) throw new Error('Unknown auction outcome');
  const value = load(lotId);
  let state = value.state;
  let now = clock(value);
  if (state.stage === 'announced' && now < state.opensAt) {
    now = state.opensAt;
    return save({ ...value, offset: now - Date.now(), state: { ...state, stage: 'open' } }, lotId);
  }
  if (['announced', 'open'].includes(state.stage)) {
    now = Math.max(now, state.openEndsAt);
    state = closeOpenRound(state, { now: state.openEndsAt });
  } else if (['sealed', 'tie'].includes(state.stage)) {
    if (now < state.roundEndsAt) {
      const ids = state.participantIds;
      const opponent = ids.find(id => id !== YOU);
      const own = state.sealedBids.find(b => b.userId === YOU);
      const highest = Math.max(state.floor, ...state.sealedBids.map(b => b.amount));
      const target = own?.amount ?? highest + 1000;
      if (!own && ids.includes(YOU)) state = placeSealedBid(state, { userId: YOU, amount: target, now });
      if (opponent && !state.sealedBids.some(b => b.userId === opponent)
        && (outcome !== 'normal' || target > state.floor || !ids.includes(YOU))) {
        const amount = outcome === 'tie' ? target : outcome === 'lose' ? Math.max(highest, target) + 1000 : state.floor;
        state = placeSealedBid(state, { userId: opponent, amount, now });
      }
    }
    now = Math.max(now, state.roundEndsAt);
    state = closeSealedRound(state, { now: state.roundEndsAt });
  } else return auctionSnapshot(lotId);
  return save({ ...value, state, offset: now - Date.now() }, lotId);
}

// Another tab may be bidding on a different lot. Invalidate just the changed lot.
globalThis.addEventListener?.('storage', event => {
  const lots = event.key === null ? AUCTION_LOTS : AUCTION_LOTS.filter(lot => storageKey(lot.id) === event.key);
  for (const lot of lots) { sessions.delete(lot.id); emit(lot.id); }
});
