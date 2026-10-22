/** Pure demo auction engine. Times are explicit epoch milliseconds; money is whole HKD.
 * User-confirmed: announce → open → top ten distinct people → hidden bids at least
 * the open-round high → repeat hidden rounds among highest ties until one winner.
 * Hidden bids can be revised up or down until each round's exact deadline.
 * One latest confirmed bid per person counts; earlier revisions are audit history.
 * Provisional demo policies: fewer than ten all advance; empty rounds are no-sale;
 * tie-round floor is the previous tied amount; unresolved tenth-place ties require review.
 * This state is PRIVATE: only publicView may feed the fan-facing UI. A browser demo
 * cannot provide server-side confidentiality, authorization or real settlement.
 */
import { t } from './i18n.js';

const fail = (message) => { throw new Error(message); };
const integer = (value, label, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`Invalid ${label}`);
  return value;
};
const identity = value => typeof value === 'string' && value.trim().length > 0;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const highest = bids => bids.reduce((max, bid) => Math.max(max, bid.amount), 0);
const atTime = (s, now) => {
  integer(now, 'time');
  if (now < s.lastActionAt) fail(t('Time precedes the last action'));
};
const authorized = (s, userId) => {
  if (!identity(userId) || !s.eligibleIds.includes(userId)) fail(t('Inner Circle eligibility required'));
};
const deadline = (now, duration) => integer(now + duration, 'round deadline');

export function createAuction({ id, opensAt, openEndsAt, sealedDurationMs, openingPrice = 5000, increment = 100, eligibleIds = [] }) {
  if (!identity(id)) fail('Invalid auction id');
  integer(opensAt, 'opening time'); integer(openEndsAt, 'open deadline');
  integer(sealedDurationMs, 'sealed duration', 1);
  integer(openingPrice, 'opening price', 1); integer(increment, 'increment', 1);
  if (openEndsAt <= opensAt) fail('Open deadline must follow opening time');
  deadline(openEndsAt, sealedDurationMs);
  if (!Array.isArray(eligibleIds) || eligibleIds.some(id => !identity(id))) fail('Invalid eligible identities');
  return freeze({ id, opensAt, openEndsAt, sealedDurationMs, openingPrice, increment,
    eligibleIds: [...new Set(eligibleIds)], stage: 'announced', openBids: [],
    participantIds: [], sealedBids: [], sealedBidHistory: [], round: 0, roundStartsAt: null, roundEndsAt: null,
    floor: openingPrice, openHighest: null, winner: null, reason: null,
    lastActionAt: 0, lastClosedAt: null });
}

export function placeOpenBid(s, { userId, amount, now }) {
  atTime(s, now); authorized(s, userId); integer(amount, 'amount', 1);
  if (!['announced', 'open'].includes(s.stage) || now < s.opensAt || now >= s.openEndsAt) fail(t('Open round is not accepting bids'));
  const minimum = s.openBids.length ? highest(s.openBids) + s.increment : s.openingPrice;
  integer(minimum, 'minimum bid', 1);
  if (amount < minimum) fail(t('Bid is below the open minimum'));
  return freeze({ ...s, stage: 'open', openBids: [...s.openBids, { userId, amount, at: now }], lastActionAt: now });
}

export function closeOpenRound(s, { now }) {
  integer(now, 'time');
  if (!['announced', 'open'].includes(s.stage)) return s;
  atTime(s, now);
  if (now < s.openEndsAt) fail(t('Open round has not ended'));
  const best = new Map();
  for (const bid of s.openBids) {
    if (!best.has(bid.userId) || best.get(bid.userId).amount < bid.amount) best.set(bid.userId, bid);
  }
  const ranked = [...best.values()].sort((a, b) => b.amount - a.amount);
  const common = { ...s, lastActionAt: now, lastClosedAt: now };
  if (!ranked.length) return freeze({ ...common, stage: 'no-sale', reason: 'no-open-bids' });
  if (ranked.length > 10 && ranked[9].amount === ranked[10].amount) {
    return freeze({ ...common, stage: 'review', reason: 'cutoff-tie' });
  }
  return freeze({ ...common, stage: 'sealed', participantIds: ranked.slice(0, 10).map(b => b.userId),
    openHighest: ranked[0].amount, floor: ranked[0].amount, round: 1,
    roundStartsAt: now, roundEndsAt: deadline(now, s.sealedDurationMs), sealedBids: [] });
}

export function placeSealedBid(s, { userId, amount, now }) {
  atTime(s, now); authorized(s, userId); integer(amount, 'amount', 1);
  if (!['sealed', 'tie'].includes(s.stage) || now < s.roundStartsAt || now >= s.roundEndsAt) fail(t('Hidden round is not accepting bids'));
  if (!s.participantIds.includes(userId)) fail(t('Not qualified for this round'));
  if (amount < s.floor) fail(t('Bid is below the hidden-round floor'));
  const previous = s.sealedBids.find(b => b.userId === userId);
  const next = { userId, amount, at: now, revision: previous ? (previous.revision || 1) + 1 : 1 };
  // Backfill only the current round's known receipts for older saved demo states.
  // Never invent inaccessible past-round history or use superseded bids to settle.
  const history = s.sealedBidHistory || s.sealedBids.map(b => ({ ...b, revision: b.revision || 1, round: s.round }));
  return freeze({ ...s,
    sealedBids: [...s.sealedBids.filter(b => b.userId !== userId), next],
    sealedBidHistory: [...history, { ...next, round: s.round }], lastActionAt: now });
}

export function closeSealedRound(s, { now }) {
  integer(now, 'time');
  if (['settled', 'no-sale', 'review'].includes(s.stage)) return s;
  if (!['sealed', 'tie'].includes(s.stage)) fail(t('No hidden round to close'));
  // Retrying the same transition must not immediately close its newly opened round.
  if (s.lastClosedAt === now) return s;
  atTime(s, now);
  if (now < s.roundEndsAt) fail(t('Hidden round has not ended'));
  const common = { ...s, lastActionAt: now, lastClosedAt: now };
  if (!s.sealedBids.length) return freeze({ ...common, stage: 'no-sale', reason: 'no-sealed-bids' });
  const max = highest(s.sealedBids);
  const leaders = s.sealedBids.filter(b => b.amount === max);
  if (leaders.length === 1) return freeze({ ...common, stage: 'settled', winner: { userId: leaders[0].userId, amount: max } });
  return freeze({ ...common, stage: 'tie', participantIds: leaders.map(b => b.userId),
    floor: Math.max(s.openHighest, max), round: s.round + 1, sealedBids: [],
    roundStartsAt: now, roundEndsAt: deadline(now, s.sealedDurationMs) });
}

export function publicView(s, userId, now) {
  integer(now, 'time');
  const stage = s.stage === 'announced' && now >= s.opensAt ? 'open' : s.stage;
  const hidden = ['sealed', 'tie'].includes(stage);
  const eligible = s.eligibleIds.includes(userId);
  const qualified = hidden ? s.participantIds.includes(userId) : eligible;
  const own = hidden ? s.sealedBids.find(b => b.userId === userId) : null;
  const floor = stage === 'open' && s.openBids.length ? highest(s.openBids) + s.increment : s.floor;
  const end = hidden ? s.roundEndsAt : s.openEndsAt;
  return freeze({ id: s.id, stage, opensAt: s.opensAt, openingPrice: s.openingPrice,
    deadline: end, floor, round: s.round, eligible, qualified,
    ownBid: own ? { amount: own.amount, submitted: true, revision: own.revision || 1 } : null,
    canBid: eligible && qualified && now < end && (hidden ? now >= s.roundStartsAt : stage === 'open' && now >= s.opensAt),
    reason: s.reason, winner: stage === 'settled' ? { ...s.winner } : null });
}
