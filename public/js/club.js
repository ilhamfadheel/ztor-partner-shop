import { ICONS } from './util.js';
import { member, tierOf, TIERS, rewardStatus, claimReward, safeReturn } from './member-store.js';
import { rewardCatalog } from './reward-config.js';
import { esc, action, dialog, notify, reveal, motionOK, trackMotion } from './club-ui.js';
import { mountDrawer, openDrawer } from './drawer.js';
import { mountMemberMetal } from './member-metal.js';
import { rewardPreview, rewardTasks, rewardIsReady, rewardCover } from './reward-presentation.js';
import { openEarnPoints } from './earning-ui.js';
import { leaderboardRows, nextTierProgress } from './member-progress.js';
import * as state from './ztor/state.js';
import { viewOf, TITLES } from './club-routes.js';
import { money as priceOf, mediaUrl, COLLECTIONS } from './ztor/map.js';
import { api, ApiError } from './ztor/api.js';
import { signInHref, signOut, signInEmbed, rememberReturnTo } from './ztor/session.js';
import { t, translateDocument, locale } from './i18n.js';

translateDocument();
const root = document.getElementById('club-main');
let view = document.documentElement.dataset.clubView || 'home';
// What each view reads from Ztor, loaded before the first render (member + bag on every page).
const PARTS = { home: ['vault', 'products'], rewards: ['vault', 'products'], leaderboard: ['board'], shop: ['products'], account: ['vault', 'orders'], profile: ['orders'] };
await state.hydrate(['member', 'cart', ...(PARTS[view] ?? [])]);
let rewardFilter = 'all';
let shopFilter = 'all';
let auctionCleanup = null;
let auctionLoading = false;
let memberMetalCleanup = null;
let profileCleanup = null;
let profileLoading = false;
const num = value => Number(value || 0).toLocaleString(locale());
const mediaName = { note:t('Private note'), photo:t('Exclusive photo'), video:t('Exclusive film'), voice:t('Voice message'), music:t('Unreleased audio') };
const ORDER_STATUS = { PAID: t('Paid'), COMPLETED: t('Completed'), CANCEL_PENDING: t('Cancellation in progress'), CANCELLED: t('Cancelled') };
/** The shop's search phrase (?q=), at most 100 characters as the Creator API takes. */
const shopQuery = () => (new URLSearchParams(location.search).get('q') || '').trim().slice(0, 100);
const returnHere = () => location.pathname + location.search + location.hash;
const joinLink = () => '/signup?return=' + encodeURIComponent(returnHere());
const profileLink = () => '/edit-profile' + (view==='profile' ? location.search : '?return='+encodeURIComponent(returnHere()));

/** The nav's current item follows the view (rendered in place, see go()). */
function setNav() {
  document.querySelectorAll('.club-nav a').forEach(a => {
    const on = viewOf(a.href) === view;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.querySelector('.club-nav-marker')?.remove();
    if (on) a.insertAdjacentHTML('beforeend', '<span class="club-nav-marker" aria-hidden="true"></span>');
  });
}

/**
 * Moves to another club page in place — no new document, so no "Opening your club…": the view
 * changes, the URL follows (history), the data comes from the tab's snapshot (state.js) and is
 * refreshed in the background.
 */
async function go(href, { push = true } = {}) {
  const next = viewOf(href);
  if (!next) return location.assign(href);
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  profileCleanup?.(); profileCleanup = null;
  auctionCleanup?.(); auctionCleanup = null;
  memberMetalCleanup?.(); memberMetalCleanup = null;
  view = next;
  document.documentElement.dataset.clubView = next;
  document.title = TITLES[next];
  if (push) history.pushState({ club: true }, '', href);
  setNav();
  await state.hydrate(['member', 'cart', ...(PARTS[view] ?? [])]);
  await render(true);
  const url = new URL(location.href);
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
  else scrollTo({ top: 0 });
  if (view === 'rewards' && url.searchParams.get('reward')) openReward(url.searchParams.get('reward'));
}

function mountHeader() {
  const routes = [['home','/fan-club',t('Fan Club')],['rewards','/rewards',t('Missions')],['shop','/shop',t('Shop')],['auction','/auction',t('Auction')],['leaderboard','/leaderboard',t('Leaderboard')]];
  // lloud.club's header: a RUNWAY button, the account icon (your account, or sign-in when signed out) and the bag.
  document.querySelector('[data-slot="header"]').outerHTML = `<header class="club-header"><div class="club-header-top"><a class="club-brand" href="/" aria-label="${t('Back to LLOUD runway')}"><img src="assets/brand/brand-logo.svg" alt="LLOUD"><span>${t('Fan Club')}</span></a><div class="club-header-actions"><a class="club-runway-link" href="/">${t('RUNWAY')}</a><a class="club-account" href="/account" data-member-link aria-label="${t('Account')}" title="${t('Account')}">${ICONS.account}</a><button type="button" class="club-bag" aria-label="${t('Shopping bag')}" aria-haspopup="dialog">${ICONS.bag}<span data-bag-count aria-hidden="true"></span></button></div></div><nav class="club-nav" aria-label="${t('Fan Club')}">${routes.map(([,url,label]) => `<a href="${url}">${label}</a>`).join('')}</nav></header>`;
  setNav();
  document.querySelector('.club-header-top').insertBefore(document.querySelector('.club-nav'),document.querySelector('.club-header-actions'));
  {
    const header = document.querySelector('.club-header');
    const mobileHeader = matchMedia('(max-width:700px)');
    let scrollAnchor = Math.max(0, scrollY);
    const syncHeader = () => {
      const y = Math.max(0, Math.min(scrollY, document.documentElement.scrollHeight - innerHeight));
      if (view !== 'home' || !mobileHeader.matches || y <= header.offsetHeight) {
        header.classList.remove('is-scroll-hidden');
        scrollAnchor = y;
        return;
      }
      if (Math.abs(y - scrollAnchor) < 8) return;
      header.classList.toggle('is-scroll-hidden', y > scrollAnchor);
      scrollAnchor = y;
    };
    addEventListener('scroll', syncHeader, { passive: true });
    mobileHeader.addEventListener('change', syncHeader);
    header.addEventListener('focusin', () => header.classList.remove('is-scroll-hidden'));
  }
  mountDrawer();
  const bag = document.querySelector('.club-bag');
  bag.addEventListener('click', () => openDrawer(bag));
  ['drawer:open','drawer:close'].forEach(type => document.addEventListener(type, () => {
    const open = document.body.classList.contains('cart-open');
    root.inert = open; document.querySelector('.club-header').inert = open;
  }));
  const updateBag = () => {
    const count = state.lines().reduce((sum,p) => sum + Math.max(0,Number(p.qty) || 0),0);
    document.querySelector('[data-bag-count]').textContent = count ? count > 99 ? '99+' : String(count) : '';
    bag.setAttribute('aria-label',count ? count===1 ? t('Shopping bag, 1 item') : t('Shopping bag, {count} items', { count }) : t('Shopping bag'));
  };
  updateBag(); document.addEventListener('cart:change', updateBag);
  if (new URLSearchParams(location.search).get('view') === 'bag') queueMicrotask(() => openDrawer(bag));
}
function pass(who) {
  const tier = tierOf(who.tier);
  return `<div class="member-pass" data-tier="${who.id ? tier.id : 'fan'}" data-pass-motion="still" data-reveal><div class="member-pass-surface" aria-hidden="true"><div class="member-pass-facets"></div><div class="member-pass-glint"></div></div><div class="member-pass-top"><img src="assets/brand/brand-logo.svg" alt="LLOUD"><span>${t('YOUR FAN PASS')}</span></div><div class="member-pass-middle"><div class="pass-tier">${who.id ? esc(t(tier.name)) : t('A place for you.')}</div><div class="pass-band">${who.id ? esc(t(tier.band)) : t('Your story starts here.')}</div></div><div class="member-pass-bottom"><span>${who.id ? esc(who.name) : t('JOIN THE CLUB')}</span><span>${who.id ? t('MEMBER · 2026') : t('LLOUD · ALL TOGETHER')}</span></div></div>`;
}
function productCard(p) {
  const tag = p.soldOut ? t('Sold out') : p.flag ? t(p.flag) : '';
  // The collection rides along so the product page paints in its world from the first frame.
  return `<a class="club-product" href="/product?id=${encodeURIComponent(p.slug)}${p.collection ? `&collection=${p.collection}` : ''}" data-reveal><div class="club-product-image">${tag ? `<span class="club-access-tag">${esc(tag)}</span>` : ''}${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" width="480" height="600">` : ''}</div><div class="club-product-meta"><div><h3>${esc(p.name)}</h3><p>${esc(p.category)}</p></div><span>${priceOf(p.price, p.currency)}${p.maxPrice > p.price ? '+' : ''}</span></div></a>`;
}
function levelProgress(who) {
  if(!who.id) return '';
  const next=nextTierProgress(who);
  if(!next.nextTierId) return `<div class="member-next-level"><span class="club-kicker">${t('Inner Circle')}</span><strong>${t('You’re in the closest circle.')}</strong><p>${t('Your support keeps your place. Levels are refreshed every week.')}</p></div>`;
  if(!next.available) return `<div class="member-next-level"><span class="club-kicker">${t('Next · {tier}', { tier: esc(t(next.nextTierName)) })}</span><strong>${t('Keep your story moving.')}</strong><p>${t('This week’s points line isn’t set yet. Your target follows your rank among the artist’s fans.')}</p><button class="club-text-link" data-earn-points>${t('Go earn points')} ↗</button></div>`;
  return `<div class="member-next-level"><div class="member-next-heading"><span>${t('Next · {tier}', { tier: esc(t(next.nextTierName)) })}</span><strong>${next.remaining?t('{n} points to go', { n: num(next.remaining) }):t('Current reference line reached')}</strong></div><div class="member-level-progress" role="progressbar" aria-label="${t('Progress to current next-level points reference')}" aria-valuenow="${Math.round(next.percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${next.percent}%"></span></div><p>${t('{recent} / {target} points · This week’s line for {tier}. It moves with the ranking.', { recent: num(who.recent), target: num(next.targetPoints), tier: esc(t(next.nextTierName)) })}</p></div>`;
}
function home() {
  const who = member();
  const ready = rewardCatalog().filter(r => r.published && rewardIsReady(r) && rewardStatus(r.id).unlocked && !who.claimed.includes(r.id));
  const picks = state.products().slice(0, 3);
  const unlocked = rewardCatalog().filter(r => rewardStatus(r.id).unlocked).length;
  return `<section class="club-hero club-hero--membership"><div class="club-hero-copy" data-reveal><span class="club-kicker">${t('More than a fan.')}</span><h1>${t('Your place in LLOUD.')}</h1><p class="club-lead">${t('Your loyalty. Your unlocks. Your next little discovery.')}</p>${nextMission(who)}<div class="club-actions">${action(who.id ? t('Explore your rewards') : t('Join the club'), who.id ? '/rewards' : joinLink())}<button class="club-button is-secondary" data-earn-points>${t('How to earn points')}<span aria-hidden="true">↗</span></button></div>${who.id ? '' : `<p class="club-quiet" style="margin-top:18px">${t('Free to join. Your loyalty opens doors.')}</p>`}</div><div class="club-membership">${pass(who)}${who.id ? `${levelProgress(who)}<div class="club-stats"><div class="club-stat"><strong>${who.rank ? '#'+num(who.rank) : '—'}</strong><span>${t('Your creator rank')}</span></div><div class="club-stat"><strong>${num(who.lifetime)}</strong><span>${t('Lifetime points')}<small>${t('Decide your rank & level')}</small></span></div><div class="club-stat"><strong>${num(unlocked)}</strong><span>${t('Rewards unlocked')}<small>${t('Yours to keep')}</small></span></div></div>` : ''}</div></section>
  <section class="club-feature" data-reveal><div class="club-feature-art"><div class="club-envelope"><img src="assets/brand/brand-logo.svg" alt="${t('Sealed LLOUD reward')}"></div></div><div class="club-feature-copy"><span class="club-kicker">${t('Your secret rewards')}</span><h2>${ready.length ? t('Something is waiting for you.') : t('A little closer. A little more yours.')}</h2><p>${ready.length ? ready.length === 1 ? t('1 reward is ready to open. Exclusive moments, earned by being here.') : t('{n} rewards are ready to open. Exclusive moments, earned by being here.', { n: ready.length }) : t('Exclusive films. Private messages. Unreleased sounds. Follow a mission and unlock something special.')}</p>${action(ready.length ? t('Open your rewards') : t('See the missions'),'/rewards',true)}</div></section>
  ${picks.length ? `<section class="club-section"><div class="club-section-head"><h2>${t('Wear your world.')}</h2><a class="club-text-link" href="/shop">${t('Explore the shop')} ↗</a></div><div class="club-grid club-products-grid">${picks.map(productCard).join('')}</div></section>` : ''}
  <section class="club-section" id="membership"><div class="club-section-head"><h2>${t('Closer, in your own way.')}</h2><a class="club-text-link" href="/leaderboard">${t('Your place in the circle')} ↗</a></div><p class="club-lead">${t('Your level follows your rank among the artist’s fans, by the points you earn with them. Levels are refreshed every week; moving up happens the moment you pass the line.')}</p><div class="club-tier-rows">${TIERS.map(tier => `<div class="club-tier-row"><strong>${esc(t(tier.name))}${who.id && who.tier === tier.id ? ` <span class="club-you-badge">${t('You')}</span>` : ''}</strong><p>${esc(t(tier.benefit))}</p><small>${esc(t(tier.band))}</small></div>`).join('')}</div><p class="club-quiet" style="margin-top:18px">${t('Levels are based on community rank, not a fixed points target. Rewards you have earned stay yours when your level changes.')}</p></section>`;
}
function nextMission(who) {
  const catalog=rewardCatalog().filter(r=>r.published);
  const reward=catalog.find(r=>rewardIsReady(r)&&rewardStatus(r.id).unlocked&&!who.claimed.includes(r.id))
    || catalog.filter(r=>!rewardStatus(r.id).unlocked).sort((a,b)=>rewardStatus(b.id).progress-rewardStatus(a.id).progress)[0];
  if(!reward) return `<aside class="club-next-mission"><div><span class="club-kicker">${t('Your next move')}</span><h3>${t('Your collection is up to date.')}</h3><p>${t('Keep supporting the artist to earn points.')}</p><button class="club-text-link" data-earn-points>${t('How to earn points')} ↗</button></div></aside>`;
  const status=rewardStatus(reward.id), missing=status.conditions.filter(c=>!c.met);
  const condition=reward.conditions.find((c,i)=>!status.conditions[i]?.met);
  const cta=status.unlocked ? `<button class="club-text-link" data-open-reward="${esc(reward.id)}">${t('Open your reward')} ↗</button>`
    : !who.id ? action(t('Join to start'),joinLink(),true)
    : condition?.type==='product' ? action(t('Shop this piece'),'/product?id='+encodeURIComponent(condition.value),true)
    : `<button class="club-text-link" data-earn-points>${t('How to earn points')} ↗</button>`;
  return `<aside class="club-next-mission" aria-label="${t('Your next mission')}"><img src="${esc(rewardCover(reward))}" alt="${t('Reward cover')}" width="84" height="108"><div><span class="club-kicker">${status.unlocked?t('Ready to open'):t('Your next unlock')}</span><h3>${esc(reward.title)}</h3><p>${status.unlocked?t('Earned by you. Ready whenever you are.'):(condition?(missing.length===1?t('1 step left · {condition}', { condition: esc(conditionLabel(condition)) }):t('{n} steps left · {condition}', { n: missing.length, condition: esc(conditionLabel(condition)) })):t('Free for every member. Join to open it.'))}</p>${cta}</div></aside>`;
}
function conditionLabel(condition) {
  if (condition.type === 'tier') return t('Reach {tier}', { tier: t(tierOf(condition.value).name) });
  if (condition.type === 'product') return t('Own the {piece}', { piece: state.product(condition.value)?.name || t('selected piece') });
  if (condition.type === 'supported') return t('Back the co-creation');
  if (condition.type === 'follow') return t('Follow the artist on Ztor');
  return t('Earn {n} lifetime points', { n: num(condition.value) });
}
function rewardCard(reward,index) {
  const who = member(), status = rewardStatus(reward.id);
  const percentage = Math.round(status.progress * 100);
  const opened = who.claimed.includes(reward.id);
  return `<article class="reward-card ${status.unlocked ? 'is-unlocked' : ''}" data-reveal data-reward-id="${esc(reward.id)}">${rewardPreview(reward,status,index)}<div class="reward-info">${rewardTasks(reward,status,who,{compact:true})}<button class="club-button ${status.unlocked ? 'is-red' : 'is-secondary'}" type="button" data-open-reward="${esc(reward.id)}">${status.unlocked ? !rewardIsReady(reward) ? t('Content coming soon') : opened ? t('Open reward') : t('Reveal your reward') : t('See how to unlock')}<span aria-hidden="true">↗</span></button></div></article>`;
}
function rewards() {
  const all = rewardCatalog().filter(r => r.published);
  const list = all.filter(r => rewardFilter === 'all' || (rewardFilter === 'unlocked') === rewardStatus(r.id).unlocked);
  return `<div data-reveal><span class="club-kicker">${t('Earned. Not ordinary.')}</span><h1>${t('Your secret rewards.')}</h1><p class="club-lead">${t('Small missions. Moments you won’t find anywhere else. Every unlocked reward becomes part of your collection.')}</p></div><div class="club-tabs" aria-label="${t('Filter rewards')}">${[['all',t('All rewards')],['unlocked',t('Unlocked')],['locked',t('To discover')]].map(([id,label]) => `<button type="button" data-reward-filter="${id}" aria-pressed="${rewardFilter===id}">${label}</button>`).join('')}</div>${list.length ? `<div class="club-grid">${list.map((r,i) => rewardCard(r,all.indexOf(r))).join('')}</div>` : `<div class="club-empty"><h2>${t('More to discover.')}</h2><p>${t('No rewards in this view yet. Complete a mission or explore all rewards.')}</p><button class="club-button" data-reward-filter="all">${t('See all rewards')}</button></div>`}`;
}
function shareInvite() {
  // ponytail: preview only. The ref parameter is not counted anywhere yet; wire to the real invite service later.
  const link=new URL('/signup?ref='+encodeURIComponent(member().id||'friend'),location.href).href;
  if(!navigator.clipboard) return notify(link);
  navigator.clipboard.writeText(link).then(()=>notify(t('Invite link copied. Send it to a friend.')),()=>notify(link));
}
async function openReward(id) {
  let reward = rewardCatalog().find(r => r.id === id && r.published);
  if (!reward) return notify(t('This reward is no longer available.'));
  const status = rewardStatus(id), who = member();
  if (!status.unlocked) {
    dialog(t('Make it yours.'), `<div class="reward-detail">${rewardPreview(reward,status,rewardCatalog().findIndex(r=>r.id===id))}${rewardTasks(reward,status,who)}</div>`,node=>{
      node.classList.add('reward-dialog');
      node.addEventListener('click',e=>{if(e.target.closest('[data-earn-points]'))openEarnPoints(node);if(e.target.closest('[data-invite-link]'))shareInvite();});
    });
    return;
  }
  // The media itself comes from the vault only now: a short-lived link, for this fan.
  let opened;
  try { opened = await api.openReward(id); }
  catch (error) { return notify(error instanceof ApiError && error.status === 403 ? t('This reward is still locked. Check the steps to unlock it.') : t('This reward could not be opened. Please try again.')); }
  reward = { ...reward, mediaUrl: opened.url, allowDownload: opened.allowDownload };
  const pending=!rewardIsReady(reward);
  const first=!who.claimed.includes(id) && !pending;
  try { if (!pending && !claimReward(id)) return notify(t('This reward could not be opened. Try again.')); }
  catch { return notify(t('Your reward could not be saved in this browser. Please try again.')); }
  const rewardDialog = dialog(pending?t('Your access is earned.'):t('A moment, just for you.'), `<span class="club-kicker">${pending?t('Content coming soon'):t('Unlocked')} · ${mediaName[reward.type]}</span><h3>${esc(reward.title)}</h3><p>${esc(reward.subtitle)}</p><div class="reward-unlock-frame"><div data-reward-content></div>${first?`<div class="reward-reveal-stage"><span class="reward-unlock-glint" aria-hidden="true"></span><div class="club-envelope"><img src="assets/brand/brand-logo.svg" alt="${t('Your unlocked reward')}"></div></div>`:''}</div>`, node => {
    const outlet=node.querySelector('[data-reward-content]');
    if (pending) outlet.innerHTML = `<div class="reward-media-placeholder"><strong>${t('Access earned · content coming soon.')}</strong><p>${t('Nothing else to complete. Your access is saved; the {media} will appear here when the creator adds it.', { media: mediaName[reward.type].toLowerCase() })}</p><small class="club-quiet">${t('No content is available yet. No simulated Lisa media.')}</small></div>`;
    else if (reward.type === 'note') outlet.innerHTML = `<div class="reward-note-body">${esc(reward.body)}</div><p class="club-quiet">${t('Creator-configured preview note. Not a personal message from Lisa.')}</p>`;
    else if (reward.type === 'photo') outlet.innerHTML = `<img class="reward-media" src="${esc(reward.mediaUrl)}" alt="${esc(reward.title)}">${reward.allowDownload ? `<a class="club-text-link" href="${esc(reward.mediaUrl)}" download>${t('Download')} ↓</a>` : ''}`;
    else outlet.innerHTML = reward.type === 'video' ? `<video class="reward-media" controls playsinline preload="metadata" src="${esc(reward.mediaUrl)}" ${reward.coverUrl ? `poster="${esc(reward.coverUrl)}"` : ''}></video><p class="club-quiet" data-media-status>${t('Press play when you’re ready.')}</p>` : `<audio class="reward-media" controls preload="metadata" src="${esc(reward.mediaUrl)}"></audio><p class="club-quiet" data-media-status>${t('Press play when you’re ready.')}</p>`;
    outlet.querySelector('video,audio')?.addEventListener('error',()=>{outlet.querySelector('[data-media-status]').textContent=t('This recording could not load. Close and reopen to try again.');});
    outlet.querySelector('img.reward-media')?.addEventListener('error',()=>notify(t('This photo could not load. Close and reopen to try again.')));
    const stage=node.querySelector('.reward-reveal-stage');
    if(stage && window.gsap && motionOK()) {
      const tween=trackMotion(gsap.timeline({onComplete:()=>stage.remove()})
        .to(stage.querySelector('.club-envelope'),{opacity:0,duration:.12,ease:'power2.out'},0)
        .fromTo(node.querySelector('.club-kicker'),{opacity:0},{opacity:1,duration:.18},.08)
        .fromTo(stage.querySelector('.reward-unlock-glint'),{opacity:0,scaleX:.6},{opacity:1,scaleX:1,duration:.12,ease:'power2.out'},.12)
        .to(stage,{opacity:0,duration:.12,ease:'power2.out'},.24));
      node.addEventListener('close',()=>tween.kill(),{once:true});
    } else stage?.remove();
  });
  rewardDialog.addEventListener('close', () => root.querySelector(`[data-open-reward="${CSS.escape(id)}"]`)?.focus({preventScroll:true}), {once:true});
}
function shop() {
  const all = state.products();
  const q = shopQuery();
  const pool = q ? state.found(q) ?? [] : all;
  const list = pool.filter(p => shopFilter === 'all' || p.collection === shopFilter);
  // lloud.club's filters: every piece, then each collection the artist's store has pieces in.
  const tabs = [['all', t('All pieces')], ...COLLECTIONS.filter(([id]) => all.some(p => p.collection === id))];
  const where = shopFilter === 'all' ? null : esc(COLLECTIONS.find(([id]) => id === shopFilter)?.[1] ?? t('this collection'));
  const empty = q
    ? state.failed('search') ? t('The search could not finish. Please try again.') : where ? t('Nothing in {collection} matches “{q}”.', { collection: where, q: esc(q) }) : t('Nothing matches “{q}”.', { q: esc(q) })
    : state.failed('products') ? t('The shop is taking a short break. Please check back soon.') : t('New pieces are on their way.');
  const matches = list.length === 1
    ? where ? t('1 piece matches “{q}” in {collection}', { q: esc(q), collection: where }) : t('1 piece matches “{q}”', { q: esc(q) })
    : where ? t('{n} pieces match “{q}” in {collection}', { n: num(list.length), q: esc(q), collection: where }) : t('{n} pieces match “{q}”', { n: num(list.length), q: esc(q) });
  const search = `<form class="club-shop-search" role="search" action="/shop" data-shop-search><label class="club-sr-only" for="shop-q">${t('Search the shop')}</label><input id="shop-q" type="search" name="q" maxlength="100" value="${esc(q)}" placeholder="${t('Search pieces')}" autocomplete="off"><button class="club-button is-secondary" type="submit">${t('Search')}</button></form>`;
  const result = q && state.found(q) ? `<p class="club-shop-result" role="status">${matches} · <a class="club-text-link" href="/shop">${t('Clear')}</a></p>` : '';
  return `<div data-reveal><span class="club-kicker">${t('Wear your world.')}</span><h1>${t('The collection is yours to explore.')}</h1><p class="club-lead">${t('Everyday favourites, straight from the artist’s store.')}</p></div>${search}${tabs.length > 1 ? `<div class="club-tabs" aria-label="${t('Filter pieces')}">${tabs.map(([id,label]) => `<button data-shop-filter="${esc(id)}" aria-pressed="${shopFilter===id}">${esc(label)}</button>`).join('')}</div>` : ''}${result}${list.length ? `<div class="club-grid club-products-grid">${list.map(productCard).join('')}</div>` : `<div class="club-empty"><h3>${empty}</h3>${q ? `<button class="club-button is-secondary" data-shop-filter="all" data-shop-clear>${t('Show all pieces')}</button>` : ''}</div>`}`;
}
function leaderboard() {
  const who = member();
  const rows = leaderboardRows(who);
  return `<div class="club-hero"><div data-reveal><span class="club-kicker">${t('Everyone adds something.')}</span><h1>${t('All together. A little closer.')}</h1><p class="club-lead">${t('Your support writes the story. See your place among the artist’s fans.')}</p>${action(t('How membership works'),'/fan-club#membership',true)}</div>${pass(who)}</div><div class="club-section-head"><h2>${t('The circle, right now.')}</h2><span class="club-quiet">${t('Lifetime points')}</span></div>${rows.length ? `<table class="club-rank-table"><caption class="club-sr-only">${t('The artist’s fan leaderboard')}</caption><thead><tr><th scope="col">${t('Rank')}</th><th scope="col">${t('Member')}</th><th scope="col" class="rank-tier">${t('Level')}</th><th scope="col">${t('Points')}</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.you?'is-you':''}"><td>#${num(r.rank)}</td><td><div class="rank-person"><span class="rank-initial" aria-hidden="true">${esc(r.name.slice(0,1))}</span>${esc(r.name)}${r.you?' · '+t('You'):''}</div></td><td class="rank-tier">${esc(t(r.tier))}</td><td>${num(r.points)}</td></tr>`).join('')}</tbody></table>` : `<div class="club-empty"><h3>${t('The circle is just forming.')}</h3><p>${t('Shop, back a co-creation or like the artist’s posts on Ztor to be the first on the board.')}</p></div>`}<p class="club-quiet" style="margin-top:20px">${t('Ranked by the points fans earn with this artist. Your rank sets your level, refreshed every week.')}</p>`;
}
function account() {
  const who = member();
  if (!who.id) return `<div class="club-empty"><span class="club-kicker">${t('Your own little corner.')}</span><h1>${t('Make yourself at home.')}</h1><p>${t('Join to keep your membership, orders and unlocked moments together.')}</p>${action(t('Join / sign in'),joinLink())}</div>`;
  const orders = accountOrders();
  const unlockedCount = rewardCatalog().filter(r=>r.published&&rewardStatus(r.id).unlocked).length;
  return `<div class="club-hero"><div data-reveal><span class="club-kicker">${t('My account')}</span><h1>${t('Hello, {name}.', { name: esc(who.name) })}</h1><p class="club-lead">${t('Your membership. Your pieces. Your little discoveries.')}</p><div class="club-actions"><a class="club-button is-secondary" href="${esc(profileLink())}">${t('Edit profile')}</a><button class="club-text-link" data-signout>${t('Sign out')}</button></div></div>${pass(who)}</div><section id="orders"><div class="club-section-head"><h2>${t('Your orders.')}</h2><a class="club-text-link" href="/shop">${t('Explore the shop')} ↗</a></div>${orders.length ? orders.map(o => `<article class="club-order"><div class="club-order-head"><strong>${esc(o.orderNo)}</strong><span>${priceOf(o.payableAmount, o.currency)} · ${esc(ORDER_STATUS[o.displayStatus] ?? String(o.displayStatus).toLowerCase())}</span></div><div class="club-order-items">${o.items.map(p => `<a href="/product?id=${encodeURIComponent(p.productId || '')}">${p.coverUrl ? `<img src="${esc(mediaUrl(p.coverUrl))}" alt="${esc(p.title || '')}" loading="lazy">` : ''}</a>`).join('')}</div><a class="club-text-link" href="/orders/${encodeURIComponent(o.orderId)}">${t('View order details')} ↗</a></article>`).join('') : `<div class="club-empty"><h3>${t('Your first piece is waiting.')}</h3><p>${t('Your orders will appear here.')}</p>${action(t('Find something you love'),'/shop')}</div>`}</section><section class="club-section"><div class="club-section-head"><h2>${t('Your story so far.')}</h2><a class="club-text-link" href="/rewards">${t('Your rewards')} ↗</a></div><div class="club-rule-list"><div><strong>${t('Lifetime points')}</strong><span>${t('{n} points', { n: num(who.lifetime) })}</span></div><div><strong>${t('Your level')}</strong><span>${esc(t(tierOf(who.tier).name))}${who.rank ? ' · ' + t('#{rank} of {population}', { rank: num(who.rank), population: num(who.population) }) : ''}</span></div><div><strong>${t('Unlocked rewards')}</strong><span>${unlockedCount === 1 ? t('1 reward') : t('{n} rewards', { n: num(unlockedCount) })}</span></div></div></section>`;
}
/** The fan's orders from the artist's store (the account page's Orders section). */
function ordersList() {
  const orders = accountOrders();
  return orders.length ? orders.map(o => `<article class="club-order"><div class="club-order-head"><strong>${esc(o.orderNo)}</strong><span>${priceOf(o.payableAmount, o.currency)} · ${esc(ORDER_STATUS[o.displayStatus] ?? String(o.displayStatus).toLowerCase())}</span></div><div class="club-order-items">${o.items.map(p => `<a href="/product?id=${encodeURIComponent(p.productId || '')}">${p.coverUrl ? `<img src="${esc(mediaUrl(p.coverUrl))}" alt="${esc(p.title || '')}" loading="lazy">` : ''}</a>`).join('')}</div><a class="club-text-link" href="/orders/${encodeURIComponent(o.orderId)}">${t('View order details')} ↗</a></article>`).join('') : `<div class="club-empty"><h3>${t('Your first piece is waiting.')}</h3><p>${t('Your orders will appear here.')}</p>${action(t('Find something you love'),'/shop')}</div>`;
}
function signup() {
  const back = safeReturn(new URLSearchParams(location.search).get('return'));
  const { attributes } = signInEmbed();
  const attrs = Object.entries(attributes).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
  // The console's hosted buttons render into .ztor-signin (mountSignIn); the link is the way in until they do.
  return `<div class="club-auth" data-reveal><a class="club-text-link" href="${esc(back)}">← ${t('Back')}</a><span class="club-kicker" style="margin-top:28px">${t('A little more connected.')}</span><h1>${t('Welcome to your circle.')}</h1><p class="club-lead">${t('Join LLOUD. Keep the moments that matter.')}</p><div class="club-auth-providers"><div class="ztor-signin" ${attrs}></div><a class="club-provider" href="${esc(signInHref(back))}" data-signin-fallback><img src="assets/providers/ztor.svg" width="20" height="20" alt=""><span>${t('Continue with Ztor')}</span></a></div><p class="club-quiet" style="margin-top:24px">${t('One Ztor account for every artist you follow. New here? You can create your account on the next screen.')}</p></div>`;
}

/** Loads Ztor's hosted sign-in buttons (once) and draws them; the fallback link goes once they're there. */
function mountSignIn() {
  const rootEl = root.querySelector('.ztor-signin');
  if (!rootEl) return;
  rememberReturnTo(safeReturn(new URLSearchParams(location.search).get('return')));
  const { base } = signInEmbed();
  if (!base) return;
  if (!document.querySelector('link[data-ztor-signin-css]')) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${base}/signin.css" data-ztor-signin-css>`);
  const draw = () => {
    window.ZtorSignIn?.render(rootEl);
    // The embed draws after reading the console's live settings; drop the fallback once a button is there.
    const done = new MutationObserver(() => { if (rootEl.querySelector('.ztor-signin__btn')) { root.querySelector('[data-signin-fallback]')?.remove(); done.disconnect(); } });
    done.observe(rootEl, { childList: true });
  };
  if (window.ZtorSignIn) return draw();
  const script = document.createElement('script');
  script.src = `${base}/signin.js`;
  script.onload = draw;
  document.head.append(script);
}
function accountOrders() {
  return state.orders().flatMap(group => group.orders ?? []);
}
async function render(animate=false) {
  const who = member();
  const accountLink=document.querySelector('[data-member-link]');
  const accountLabel=who.id?t('Your account'):t('Join / sign in');
  accountLink.setAttribute('aria-label',accountLabel); accountLink.title=accountLabel; accountLink.href=who.id?'/account':joinLink();
  if(view==='profile' || view==='account') {
    if(!profileCleanup && !profileLoading) {
      profileLoading=true;
      // lloud.club's account page: personal details, addresses, payment methods, orders, security.
      try { const {mountAccountPage}=await import('./account-page.js'); profileCleanup=mountAccountPage(root,{renderOrders:ordersList}); }
      catch { root.innerHTML=`<div class="club-empty" role="alert"><h1>${t('Your profile could not open.')}</h1><p>${t('Your saved details are still in this browser.')}</p><a class="club-button" href="/edit-profile">${t('Try again')}</a></div>`; }
      finally {profileLoading=false;}
    }
    return;
  }
  if(view==='auction') {
    if(!auctionCleanup && !auctionLoading) {
      auctionLoading=true;
      try { const {mountAuctionPage}=await import('./auction-page.js'); auctionCleanup=mountAuctionPage(root); }
      catch { root.innerHTML=`<div class="club-empty" role="alert"><h1>${t('A moment to reconnect.')}</h1><p>${t('The auction could not load. Your saved preview bids are kept in this browser.')}</p><a class="club-button" href="/auction">${t('Try again')}</a></div>`; }
      finally {auctionLoading=false;}
    }
    return;
  }
  if(view==='shop' && shopQuery() && !state.found(shopQuery())) await state.search(shopQuery());
  memberMetalCleanup?.();
  root.innerHTML = ({home,rewards,shop,leaderboard,account,signup}[view] || home)();
  memberMetalCleanup = mountMemberMetal(root.querySelector('.member-pass'));
  if(view==='signup')mountSignIn();
  if(animate)reveal(root);
}
root.addEventListener('click',e=>{
  const target=e.target.closest('button'); if(!target)return;
  if(target.hasAttribute('data-earn-points'))openEarnPoints();
  if(target.dataset.rewardFilter){rewardFilter=target.dataset.rewardFilter;render();root.querySelector(`[data-reward-filter="${rewardFilter}"]`)?.focus({preventScroll:true});}
  if(target.dataset.shopFilter){shopFilter=target.dataset.shopFilter;if(target.hasAttribute('data-shop-clear'))return void go('/shop');render();root.querySelector(`[data-shop-filter="${shopFilter}"]`)?.focus({preventScroll:true});}
  if(target.dataset.openReward)openReward(target.dataset.openReward);
  if(target.hasAttribute('data-signout'))dialog(t('Sign out?'),`<p>${t('You’ll be signed out of LLOUD on this device. Your Ztor account, points and rewards stay as they are.')}</p><button class="club-button" data-confirm-signout>${t('Sign out')}</button>`,node=>node.querySelector('[data-confirm-signout]').addEventListener('click',()=>signOut('/')));
});
// The shop's search moves in place like a link; without this script the form is a plain GET to /shop?q=.
root.addEventListener('submit',e=>{
  const form=e.target.closest('[data-shop-search]'); if(!form)return;
  e.preventDefault();
  const q=String(new FormData(form).get('q')||'').trim().slice(0,100);
  void go(q?'/shop?q='+encodeURIComponent(q):'/shop');
});
mountHeader();
document.body.insertAdjacentHTML('beforeend',`<footer class="club-footer"><span>${t('LLOUD · A little closer, together.')}</span><span>${t('Powered by Ztor')} · <a href="/account">${t('Your account')}</a> · <a href="/">${t('Back to runway')}</a></span></footer>`);
document.documentElement.classList.add('is-site-ready');
let shownMember=member();
document.addEventListener('member:change',async event=>{
  const before=shownMember,after=member();shownMember=after;
  const sameIdentity=!!after.id && before.id===after.id;
  const tierChanged=event.detail?.saved && sameIdentity && before.tier!==after.tier;
  const oldCard=tierChanged?root.querySelector('.member-pass')?.cloneNode(true):null;
  if(view!=='signup')await render();
  if(!event.detail?.saved || !sameIdentity)return;
  if(!window.gsap || !motionOK())return;
  const card=root.querySelector('.member-pass');
  if(oldCard && card){
    oldCard.querySelectorAll('canvas,.member-pass-metal').forEach(n=>n.remove());
    oldCard.classList.add('member-material-change');oldCard.setAttribute('aria-hidden','true');oldCard.inert=true;oldCard.dataset.passMotion='still';
    card.append(oldCard);
    trackMotion(gsap.to(oldCard,{opacity:0,duration:.24,ease:'power2.out',onComplete:()=>oldCard.remove()}));
    trackMotion(gsap.fromTo(card.querySelector('.pass-tier'),{opacity:0},{opacity:1,duration:.12}));
  }
  for(const reward of rewardCatalog()){
    const oldProgress=rewardStatus(reward.id,before).progress,newProgress=rewardStatus(reward.id,after).progress;
    const bar=root.querySelector(`[data-reward-id="${CSS.escape(reward.id)}"] .reward-progress>span`);
    if(bar && newProgress>oldProgress)trackMotion(gsap.fromTo(bar,{scaleX:oldProgress/newProgress,transformOrigin:'left'},{scaleX:1,duration:.24,ease:'power2.out',clearProps:'transform'}));
  }
});
document.addEventListener('earnings:config',()=>{if(view==='home')render();});
document.addEventListener('rewards:config',()=>{if(view==='rewards'||view==='home')render();});
await render(true);
const resume=new URLSearchParams(location.search);
if(view==='rewards' && resume.get('reward'))openReward(resume.get('reward'));
if(location.hash && view!=='auction')requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
// In-place navigation between the club's pages. On window, so a page's own link handling (the
// profile's "discard changes?") runs first and can keep the fan where they are.
window.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || !viewOf(a.href)) return;
  e.preventDefault();
  void go(a.href);
});
addEventListener('popstate', () => void go(location.href, { push: false }));
addEventListener('club:navigate', e => void go(e.detail));
// The snapshot was refreshed in the background: show what's new (not under a profile being edited).
document.addEventListener('ztor:refresh', () => { if (view !== 'profile' && !(view === 'account' && (new URLSearchParams(location.search).get('section') || 'profile') === 'profile')) void render(); });
