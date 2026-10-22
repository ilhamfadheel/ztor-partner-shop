// The Creator API's answers in the shapes the LLOUD pages were designed around (member, rewards,
// leaderboard rows, products, bag lines). Pure functions: no fetch, no storage.
import config from '/lloud-config.js';

/** The loyalty service's tier names (the database's) → LLOUD's tier ids, and their display names. */
export const TIER_ID = { inner_circle: 'inner', super_fan: 'super', ranked_fan: 'ranked', fan: 'fan' };
const ORDER = ['fan', 'ranked', 'super', 'inner'];
const LABEL = { fan: 'Fan', ranked: 'Ranked Fan', super: 'Super Fan', inner: 'Inner Circle' };
const tierId = apiTier => TIER_ID[apiTier] ?? 'fan';
/** A LLOUD tier id's display name. */
export const tierLabel = id => LABEL[id] ?? 'Fan';

const GUEST = { id: null, name: 'Guest', bio: '', avatar: '', profileRevision: 0, tier: 'fan', rank: null, population: 0, lifetime: 0, recent: 0, invites: 0, joined: null, claimed: [], notices: [], completedOrders: [], purchasedProducts: [], unlockedRewards: [], missionProofs: [], completedMissions: [], demo: false, guest: true };

/**
 * LLOUD's member: the signed-in fan's Ztor profile and their standing on the platform's creator's
 * board. P0 has lifetime points only, so LLOUD's "recent" points are the lifetime ones.
 */
export function toMember({ session, account, standing, claimed = [], unlocked = [] } = {}) {
  if (!session) return { ...GUEST, population: standing?.boardSize ?? 0 };
  const name = (account?.name || session.user?.name || 'Fan').trim().slice(0, 40);
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
export const boardRows = items => items.map(r => ({ name: r.name || 'Fan', rank: r.rank, points: r.points, tier: LABEL[tierId(r.tier)], avatar: r.avatarUrl ?? null, ...(r.me ? { you: true } : {}) }));

const KIND = { photo: 'photo', video: 'video', audio: 'music' };
const CONDITION = {
  tier: c => ({ type: 'tier', value: tierId(c.target) }),
  lifetime: c => ({ type: 'lifetime', value: Number(c.target) || 0 }),
  purchased: c => ({ type: 'product', value: c.target }),
  supported: c => ({ type: 'supported', value: c.target }),
  follow: () => ({ type: 'follow', value: null }),
};

/** The Media Vault's eggs as LLOUD's flat reward catalog; the media itself is fetched on open. */
export function toRewards(eggs) {
  return eggs.flatMap(egg =>
    egg.rewards.map(r => {
      const known = r.conditions.filter(c => CONDITION[c.type]);
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
        conditions: known.map(c => CONDITION[c.type](c)),
        met: known.map(c => !!c.met),
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
    if (c.type === 'lifetime') return { label: `Earn ${c.value.toLocaleString('en-US')} lifetime points`, met, current: who.lifetime, target: c.value, progress: met ? 1 : Math.min(1, c.value ? who.lifetime / c.value : 0) };
    if (c.type === 'tier') {
      const have = ORDER.indexOf(who.tier), need = ORDER.indexOf(c.value);
      return { label: `Reach ${LABEL[c.value]}`, met, current: who.tier, target: c.value, progress: met ? 1 : need > 0 ? Math.max(0, have) / need : 0 };
    }
    const label = c.type === 'product' ? 'Purchase the selected piece' : c.type === 'supported' ? 'Back the co-creation' : 'Follow the artist on Ztor';
    return { label, met, current: met ? 1 : 0, target: 1, progress: met ? 1 : 0 };
  });
  const unlocked = !!who?.id && reward.unlocked;
  const progress = unlocked ? 1 : conditions.length ? conditions.reduce((s, c) => s + c.progress, 0) / conditions.length : 0;
  return { unlocked, progress, conditions };
}

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
export const money = (n, currency = 'HKD') => symbolOf(currency) + ' ' + Number(n || 0).toLocaleString('en-US');

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
    flag: card.limited ? 'Limited' : card.newProduct ? 'New' : '',
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
      title: item.title || 'Item',
      price: Number(item.unitPrice) || 0,
      currency: group.currency || 'HKD',
      image: mediaUrl(item.coverUrl),
      qty: item.quantity,
      max: item.maxQuantity ?? null,
      status: item.itemStatus,
    })),
  );
}
