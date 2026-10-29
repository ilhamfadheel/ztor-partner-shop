// The Creator API's answers in the shapes the LLOUD pages were designed around (member, rewards,
// leaderboard rows, products, bag lines). Pure functions: no fetch, no storage.
import config from '/lloud-config.js';
import { t, locale } from '../i18n.js';

/** The loyalty service's tier names (the database's) → LLOUD's tier ids, and their display names. */
export const TIER_ID = { inner_circle: 'inner', super_fan: 'super', ranked_fan: 'ranked', fan: 'fan' };
const ORDER = ['fan', 'ranked', 'super', 'inner'];
// Getters: each name is read in the page's language when it is shown.
const LABEL = { get fan() { return t('Fan'); }, get ranked() { return t('Ranked Fan'); }, get super() { return t('Super Fan'); }, get inner() { return t('Inner Circle'); } };
const tierId = apiTier => TIER_ID[apiTier] ?? 'fan';
/** A LLOUD tier id's display name. */
export const tierLabel = id => LABEL[id] ?? t('Fan');

const GUEST = { id: null, get name() { return t('Guest'); }, bio: '', avatar: '', profileRevision: 0, tier: 'fan', rank: null, population: 0, lifetime: 0, recent: 0, invites: 0, joined: null, claimed: [], notices: [], completedOrders: [], purchasedProducts: [], unlockedRewards: [], missionProofs: [], completedMissions: [], demo: false, guest: true };

/**
 * LLOUD's member: the signed-in fan's Ztor profile and their standing on the platform's creator's
 * board. P0 has lifetime points only, so LLOUD's "recent" points are the lifetime ones.
 */
export function toMember({ session, account, standing, claimed = [], unlocked = [], invites = 0, completedMissions = [] } = {}) {
  if (!session) return { ...GUEST, population: standing?.boardSize ?? 0 };
  const name = (account?.name || session.user?.name || t('Fan')).trim().slice(0, 40);
  const points = Number(standing?.points) || 0;
  return {
    ...GUEST,
    id: session.user.sub,
    name,
    bio: account?.bio || '',
    avatar: account?.avatarUrl || '',
    tier: tierId(standing?.tier),
    rank: standing?.rank ?? null,
    population: standing?.boardSize ?? 0,
    lifetime: points,
    recent: points,
    joined: account?.createdAt ? String(account.createdAt).slice(0, 10) : null,
    claimed: [...claimed],
    unlockedRewards: [...unlocked],
    invites,
    completedMissions: [...completedMissions],
    next: standing?.next ?? null,
    guest: false,
  };
}

/** The gap to the next tier, from this week's cut-offs (LLOUD's member-progress shape). */
export function nextTierProgress(who) {
  const index = ORDER.indexOf(who?.tier);
  const nextId = index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null;
  const empty = { nextTierId: nextId, nextTierName: nextId ? LABEL[nextId] : null, targetPoints: null, remaining: null, percent: 0, rankTarget: null, available: false };
  if (!nextId || !who?.id || !who.next) return empty;
  const target = Number(who.next.minPoints) || 0;
  return {
    ...empty,
    nextTierId: tierId(who.next.tier),
    nextTierName: LABEL[tierId(who.next.tier)],
    targetPoints: target,
    remaining: Math.max(0, Number(who.next.gap) || 0),
    percent: target ? Math.min(100, (who.lifetime / target) * 100) : 100,
    available: true,
  };
}

/** The creator's board as LLOUD's leaderboard rows (public names only). */
export const boardRows = items => items.map(r => ({ name: r.name || t('Fan'), rank: r.rank, points: r.points, tier: LABEL[tierId(r.tier)], avatar: r.avatarUrl ?? null, ...(r.me ? { you: true } : {}) }));

const KIND = { photo: 'photo', video: 'video', audio: 'music' };
const CONDITION = {
  tier: c => ({ type: 'tier', value: tierId(c.target) }),
  lifetime: c => ({ type: 'lifetime', value: Number(c.target) || 0 }),
  purchased: c => ({ type: 'product', value: c.target }),
  supported: c => ({ type: 'supported', value: c.target }),
  follow: () => ({ type: 'follow', value: null }),
  // A completed mission (its title; null when it is no longer listed) and friends counted.
  mission: c => ({ type: 'achievement', value: c.target, label: c.title ?? null }),
  invite: c => ({ type: 'invite', value: Number(c.target) || 0, current: c.current ?? 0 }),
};
// A condition this site doesn't know yet still counts: shown as a step, decided by the API.
const other = c => ({ type: 'other', value: c.target ?? null });

/** The Media Vault's eggs as LLOUD's flat reward catalog; the media itself is fetched on open. */
export function toRewards(eggs) {
  return eggs.flatMap(egg =>
    egg.rewards.map(r => {
      return {
        id: r.id,
        eggId: egg.id,
        title: r.title,
        subtitle: r.subtitle || egg.title,
        type: KIND[r.mediaKind] ?? 'photo',
        published: true,
        assetPending: false,
        vault: true,
        mediaUrl: null,
        coverUrl: r.previewUrl || egg.coverUrl || null,
        allowDownload: !!r.allowDownload,
        match: 'all',
        conditions: r.conditions.map(c => (CONDITION[c.type] ?? other)(c)),
        met: r.conditions.map(c => !!c.met),
        unlocked: !!r.unlocked,
      };
    }),
  );
}

/** LLOUD's reward status: the API decides the unlock; progress per condition is shown for the fan. */
export function rewardStatus(reward, who) {
  if (!reward) return { unlocked: false, progress: 0, conditions: [] };
  const conditions = reward.conditions.map((c, i) => {
    const met = !!reward.met[i];
    if (c.type === 'lifetime') return { label: t('Earn {points} lifetime points', { points: c.value.toLocaleString(locale()) }), met, current: who.lifetime, target: c.value, progress: met ? 1 : Math.min(1, c.value ? who.lifetime / c.value : 0) };
    if (c.type === 'tier') {
      const have = ORDER.indexOf(who.tier), need = ORDER.indexOf(c.value);
      return { label: t('Reach {tier}', { tier: LABEL[c.value] }), met, current: who.tier, target: c.value, progress: met ? 1 : need > 0 ? Math.max(0, have) / need : 0 };
    }
    if (c.type === 'invite') {
      const current = Number(c.current ?? who.invites) || 0;
      return { label: c.value === 1 ? t('Invite a friend who joins') : t('Invite {count} friends who join', { count: c.value.toLocaleString(locale()) }), met, current, target: c.value, progress: met ? 1 : Math.min(1, c.value ? current / c.value : 0) };
    }
    const label = c.type === 'product' ? t('Purchase the selected piece') : c.type === 'supported' ? t('Back the co-creation') : c.type === 'follow' ? t('Follow the artist on Ztor')
      : c.type === 'achievement' ? (c.label ? t('Complete: {title}', { title: c.label }) : t('Complete a mission')) : t('Complete a requirement');
    return { label, met, current: met ? 1 : 0, target: 1, progress: met ? 1 : 0 };
  });
  const unlocked = !!who?.id && reward.unlocked;
  const progress = unlocked ? 1 : conditions.length ? conditions.reduce((s, c) => s + c.progress, 0) / conditions.length : 0;
  return { unlocked, progress, conditions };
}

// ── missions ─────────────────────────────────────────────────────────────────
/** How LLOUD shows a mission, by how it completes on Ztor. */
const missionKind = m => m.kind === 'proof' ? (m.proof?.link && m.proof.link !== 'off' ? 'social' : 'response')
  : m.kind === 'invite' ? 'referral' : m.action === 'purchased' ? 'purchase' : m.action === 'redeemed' ? 'partner' : 'auto';
// Getters: each word is read in the page's language when it is shown.
const SEAL = { get todo() { return t('To discover'); }, get pending() { return t('In review'); }, get rejected() { return t('Needs an update'); }, get done() { return t('Complete'); }, get revoked() { return t('Not credited'); } };
const defaultCategory = m => m.action === 'redeemed' ? t('Scan & earn') : m.kind === 'invite' ? t('Community') : t('Mission');
const day = iso => new Date(iso).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' });
function availabilityText(m) {
  if (m.availability === 'upcoming') return m.startsAt ? t('Opens {date}', { date: day(m.startsAt) }) : t('Opens soon');
  if (m.availability === 'closed') return t('This mission has ended.');
  return m.endsAt ? t('Open until {date}', { date: day(m.endsAt) }) : null;
}

/** The Creator API's missions as LLOUD's mission cards; `me` (the fan's progress) is null for a visitor. */
export function toMissions(list) {
  return (list ?? []).map(m => {
    const state = m.me?.state ?? 'todo';
    return {
      id: m.id,
      kind: missionKind(m),
      action: m.action,
      target: m.target,
      targetCount: m.targetCount ?? 1,
      title: m.title,
      description: m.description ?? '',
      points: m.points,
      pointsPer: m.pointsPer,
      // The card's "+N": a code's own points when the mission adds none (the campaign credits them).
      amount: m.points > 0 ? m.points : m.campaign?.pointsPerCode ?? 0,
      category: m.category ?? defaultCategory(m),
      cover: m.coverUrl,
      media: m.mediaUrl,
      rule: m.rules,
      prizes: m.prizes ?? [],
      prizeEligibility: m.prizeNote,
      prompt: m.proof?.notePrompt ?? null,
      window: m.availability,
      availability: m.availabilityNote ?? availabilityText(m),
      checklist: m.instructions ?? [],
      benefit: m.benefit,
      actionUrl: m.actionUrl,
      actionLabel: m.actionLabel,
      proof: m.proof,
      scan: m.action === 'redeemed',
      campaign: m.campaign,
      state,
      seal: SEAL[state] ?? SEAL.todo,
      me: m.me,
    };
  });
}

/** What a mission gives, as its card says it: "+N points" (per friend), else its milestone. */
export const missionBenefit = m => m.amount > 0
  ? (m.pointsPer === 'friend' ? t('+{points} points per friend', { points: m.amount.toLocaleString(locale()) }) : t('+{points} points', { points: m.amount.toLocaleString(locale()) }))
  : m.benefit ?? '';

/** A product path from Shopping → an absolute URL on its media CDN (absolute URLs pass through). */
export function mediaUrl(src) {
  if (!src || !String(src).trim()) return '';
  try {
    const url = new URL(String(src).trim(), `${config.media}/`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

const SYMBOL = { HKD: 'HK$', TWD: 'NT$', NTD: 'NT$', USD: 'US$', SGD: 'S$' };
export const symbolOf = currency => SYMBOL[currency] ?? currency ?? 'HK$';
/** LLOUD's money format ("HK$ 2,880") in the item's own currency. */
export const money = (n, currency = 'HKD') => symbolOf(currency) + ' ' + Number(n || 0).toLocaleString(locale());

/** The Creator Studio tag that puts a product in one of LLOUD's collections (its colours, its shop filter). */
const COLLECTION_TAG = { rockstar: 'rockstar', 'beach club': 'beach', paddock: 'paddock', 'silence is loud': 'silence-is-loud' };
/** The collections the shop filters by, in lloud.club's order. */
export const COLLECTIONS = [['rockstar', 'Rockstar'], ['beach', 'Beach Club'], ['paddock', 'Paddock']];
/** A product's LLOUD collection id from its tags, or null. */
export const collectionOf = (tags = []) => (tags ?? []).map(t => COLLECTION_TAG[String(t).trim().toLowerCase()]).find(Boolean) ?? null;

/** A Creator API product card or detail as LLOUD's product (its id is LLOUD's slug). */
export function toProduct(card) {
  return {
    slug: card.productId,
    name: card.title,
    price: card.minPrice,
    maxPrice: card.maxPrice,
    currency: card.currency,
    symbol: symbolOf(card.currency),
    category: card.mainCategoryName || '',
    collection: collectionOf(card.tags),
    flag: card.limited ? t('Limited') : card.newProduct ? t('New') : '',
    image: mediaUrl(card.coverUrl),
    sellable: !!card.sellable,
    soldOut: !card.sellable || card.availabilityStatus === 'SOLD_OUT',
  };
}

/** The fan's cart (every shop group of this channel) as LLOUD's bag lines, keyed by cart item. */
export function toCartLines(cart) {
  return (cart?.shopGroups ?? []).flatMap(group =>
    group.items.map(item => ({
      id: item.cartItemId,
      slug: item.productId,
      skuId: item.skuSelections?.[0]?.skuId ?? '',
      size: item.skuSelections?.map(s => s.skuLabel).filter(Boolean).join(' · ') ?? '',
      colour: '',
      title: item.title || t('Item'),
      price: Number(item.unitPrice) || 0,
      currency: group.currency || 'HKD',
      image: mediaUrl(item.coverUrl),
      qty: item.quantity,
      max: item.maxQuantity ?? null,
      status: item.itemStatus,
    })),
  );
}
