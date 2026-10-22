// js/product.js — the product page (Product.dc.html anatomy) on a Creator API product.
//   ?id=<productId>; a missing or unknown id shows LLOUD's unavailable state with a way back to the shop.
//   Gallery (the seller's images and videos, thumbs, arrows, swipe) · buy column (flag, category, title,
//   price — a range until the options pick one SKU — option rows: colours as swatches, the rest as chips,
//   with the combinations that can't be bought struck out, qty stepper capped by the purchase limit and
//   stock, Add to bag → the fan's Ztor cart + drawer + toast, wishlist heart) · details (description,
//   the product's attributes, delivery/pickup and its note) · more from the shop · sticky buy bar.
// A signed-out fan's Add to bag goes to the Ztor sign-in and comes back here.

import * as state from './ztor/state.js';
import { ApiError } from './ztor/api.js';
import { money, collectionOf } from './ztor/map.js';
import { getCollection, setCollection } from './collection.js';
import { signInHref } from './ztor/session.js';
import {
  resolveSku, valueAvailable, pickValue, initialPicks, firstMissing, priceOf, qtyCap, isSoldOut, galleryItems, fulfilmentText
} from './ztor/commerce.js';
import { cart } from './cart.js';
import { wishlist, onWishlistChange } from './wishlist.js';
import { openDrawer } from './drawer.js';
import { toastAdded } from './toast.js';
import { escapeHtml, el, qs, qsa, bump, reflow, prefersReducedMotion, ICONS } from './util.js';
import { t } from './i18n.js';

// ── icons that are the PDP's own (Product.dc.html), not in util.ICONS ─────────
const SVG = {
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>',
  minus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z"></path></svg>',
  truck: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="1.6"></circle><circle cx="17.5" cy="18" r="1.6"></circle></svg>',
  pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>'
};

const SWIPE_PX = 40;
const RELATED = 3;

// ── state ─────────────────────────────────────────────────────────────────────
const view = {
  detail: null, card: null, gallery: [], related: [],
  view: 0, picked: {}, qty: 1, flag: null, busy: false, error: ''
};

let root = null;        // .pdp
let buybar = null;
let buybarObserver = null;

const sku = () => resolveSku(view.detail, view.picked);
const soldOut = () => isSoldOut(view.detail) || (sku() ? isSoldOut(sku()) : false);
const bundle = () => view.detail.productStructure === 'BUNDLE';

// ── templates ─────────────────────────────────────────────────────────────────
function mediaHtml(item, cls, eager) {
  if (!item) return '';
  if (item.type === 'VIDEO') {
    return '<video src="' + escapeHtml(item.url) + '"' + (cls ? ' class="' + cls + '"' : '') + ' muted loop playsinline preload="metadata"' + (eager ? ' autoplay' : '') + ' aria-label="' + escapeHtml(view.detail.title) + '"></video>';
  }
  return '<img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(view.detail.title) + '"' + (cls ? ' class="' + cls + '"' : '') +
    (eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"') + '>';
}

function cardImg(p) {
  return p.image ? '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" decoding="async">' : '';
}

function crumbsHtml(d) {
  return '<nav class="page-head__crumbs" aria-label="' + escapeHtml(t('Breadcrumb')) + '">' +
    '<a href="/shop">' + escapeHtml(t('Shop')) + '</a><span class="page-head__crumb-sep" aria-hidden="true">›</span>' +
    (d.mainCategoryName ? '<span>' + escapeHtml(d.mainCategoryName) + '</span><span class="page-head__crumb-sep" aria-hidden="true">›</span>' : '') +
    '<span class="page-head__crumb-cur" aria-current="page">' + escapeHtml(d.title) + '</span>' +
  '</nav>';
}

function galleryHtml() {
  const items = view.gallery;
  const many = items.length > 1;
  const thumbs = items.map((item, i) =>
    '<button class="pdp-gallery__thumb' + (i === view.view ? ' is-active' : '') + '" type="button" data-thumb="' + i + '" aria-label="' + escapeHtml(item.type === 'VIDEO' ? t('View {n} — video', { n: i + 1 }) : t('View {n}', { n: i + 1 })) + '" aria-pressed="' + (i === view.view) + '">' +
      mediaHtml(item, '', false) +
    '</button>').join('');
  return '<div class="pdp-gallery l-reveal" data-pdp-gallery style="--i:0">' +
    '<div class="pdp-gallery__strip" role="group" aria-label="' + escapeHtml(t('Product images')) + '">' + (many ? thumbs : '') + '</div>' +
    '<div class="pdp-gallery__stage">' +
      '<button class="pdp-gallery__frame" type="button" aria-label="' + escapeHtml(t('Next view')) + '" data-hero-frame>' +
        heroHtml() +
      '</button>' +
      (many
        ? '<button class="pdp-gallery__arrow pdp-gallery__arrow--prev" type="button" data-hero-prev aria-label="' + escapeHtml(t('Previous view')) + '">' + SVG.prev + '</button>' +
          '<button class="pdp-gallery__arrow pdp-gallery__arrow--next" type="button" data-hero-next aria-label="' + escapeHtml(t('Next view')) + '">' + SVG.next + '</button>'
        : '') +
    '</div>' +
  '</div>';
}

function heroHtml() {
  return mediaHtml(view.gallery[view.view], 'pdp-gallery__img', true).replace(/^<(img|video) /, '<$1 data-hero ');
}

const isColour = o => o.optionType === 'COLOR' || (o.values.length > 0 && o.values.every(v => v.colorCode));

function optionHtml(o) {
  const d = view.detail;
  const current = o.values.find(v => v.optionValueId === view.picked[o.optionId]);
  const header = '<div class="pdp-variant__header"><span class="pdp-variant__label">' + escapeHtml(t(o.optionName)) +
    (isColour(o) && current ? ' · <span class="pdp-variant__colour-name">' + escapeHtml(current.valueName) + '</span>' : '') + '</span></div>';
  const values = o.values.map(v => {
    const on = view.picked[o.optionId] === v.optionValueId;
    const oos = !valueAvailable(d, view.picked, o.optionId, v.optionValueId);
    const data = ' data-opt="' + escapeHtml(o.optionId) + '" data-val="' + escapeHtml(v.optionValueId) + '"';
    const label = oos ? escapeHtml(t('{name} — not available', { name: v.valueName })) : escapeHtml(v.valueName);
    if (isColour(o)) {
      return '<button class="pdp-swatch' + (on ? ' is-selected' : '') + (oos ? ' is-oos' : '') + '" type="button" role="radio" aria-checked="' + on + '"' + data +
        (oos ? ' aria-disabled="true"' : '') + ' title="' + escapeHtml(v.valueName) + '" aria-label="' + label + '" style="--swatch-bg:' + escapeHtml(v.colorCode || '') + '">' +
        '<span class="pdp-swatch__fill" aria-hidden="true"></span>' +
      '</button>';
    }
    return '<button class="pdp-size-chip' + (oos ? ' is-oos' : on ? ' is-selected' : '') + '" type="button" role="radio" aria-checked="' + on + '"' + data +
      (oos ? ' aria-disabled="true" aria-label="' + label + '"' : '') + '>' +
      '<span class="pdp-size-chip__label">' + escapeHtml(v.valueName) + '</span>' +
      (oos ? '<span class="pdp-size-chip__oos" aria-hidden="true"></span>' : '') +
    '</button>';
  }).join('');
  return '<div class="pdp-variant" data-variant="' + escapeHtml(o.optionId) + '">' + header +
    '<div class="pdp-variant__opts pdp-variant__opts--' + (isColour(o) ? 'swatches' : 'sizes') + '" role="radiogroup" aria-label="' + escapeHtml(t(o.optionName)) + '">' + values + '</div>' +
  '</div>';
}

function priceHtml() {
  const price = priceOf(view.detail, sku());
  const sub = soldOut() ? escapeHtml(t('Sold out')) : '';
  return '<span class="pdp-price__now">' + escapeHtml(price.now) + '</span>' +
    (price.was ? '<span class="pdp-price__sub"><s>' + escapeHtml(price.was) + '</s></span>' : '') +
    (sub ? '<span class="pdp-price__sub">' + sub + '</span>' : '');
}

function addLabel() {
  if (bundle()) return t('Not available here');
  if (soldOut()) return t('Sold out');
  if (view.busy) return t('Adding…');
  return t('Add to bag');
}

function buyHtml(d) {
  const card = view.card;
  const wished = wishlist.has(d.productId);
  const fulfil = fulfilmentText(d);
  return '<div class="pdp-buy l-reveal" style="--i:1">' +
    (card && card.flag ? '<span class="pdp-buy__badge status-tag status-tag--yellow">' + escapeHtml(card.flag) + '</span>' : '') +
    (d.mainCategoryName ? '<span class="pdp-buy__eyebrow t-eyebrow">' + escapeHtml(d.mainCategoryName) + '</span>' : '') +
    '<h1 class="pdp-buy__title">' + escapeHtml(d.title) + '</h1>' +
    '<div class="pdp-price" data-price aria-live="polite">' + priceHtml() + '</div>' +
    '<div class="pdp-variants" data-variants>' + d.options.map(optionHtml).join('') + '</div>' +
    '<p class="pdp-buy__guard cc-callout cc-callout--error" data-guard role="alert" hidden></p>' +
    '<div class="pdp-buy__actions">' +
      '<div class="pdp-qty" data-qty>' +
        '<button class="pdp-qty__btn" type="button" data-qty-dec aria-label="' + escapeHtml(t('Decrease quantity')) + '">' + SVG.minus + '</button>' +
        '<span class="pdp-qty__val" data-qty-val aria-live="polite" aria-label="' + escapeHtml(t('Quantity')) + '">' + view.qty + '</span>' +
        '<button class="pdp-qty__btn" type="button" data-qty-inc aria-label="' + escapeHtml(t('Increase quantity')) + '">' + SVG.plus + '</button>' +
      '</div>' +
      '<button class="btn btn--primary btn--lg pdp-buy__add" type="button" data-pdp-add>' +
        '<span class="pdp-buy__add-glyph" aria-hidden="true">' + ICONS.bagSmall + '</span>' +
        '<span data-add-label>' + escapeHtml(addLabel()) + '</span>' +
      '</button>' +
      '<button class="pdp-buy__heart" type="button" data-pdp-wish aria-pressed="' + wished + '" aria-label="' + escapeHtml(wished ? t('Remove from wishlist') : t('Add to wishlist')) + '">' + SVG.heart + '</button>' +
    '</div>' +
    (fulfil
      ? '<div class="pdp-delivery">' +
          '<span class="pdp-delivery__icon" aria-hidden="true">' + (d.fulfillmentType === 'QR_PICKUP' ? SVG.pin : SVG.truck) + '</span>' +
          '<span class="pdp-delivery__text">' + escapeHtml(fulfil) + '</span>' +
        '</div>'
      : '') +
  '</div>';
}

function paragraphs(text, cls) {
  return String(text).split(/\n{2,}/).map(t => t.trim()).filter(Boolean).map(t => '<p class="' + cls + '">' + escapeHtml(t) + '</p>').join('');
}

function detailsHtml(d) {
  const attrs = d.attributes || [];
  const fulfil = fulfilmentText(d);
  const note = d.pickupReturnNote;
  const sessions = d.fulfillmentType === 'QR_PICKUP' ? (d.pickup?.sessions ?? []) : [];
  if (!d.description && !attrs.length && !fulfil && !note) return '';
  return '<section class="pdp-details l-reveal" aria-label="' + escapeHtml(t('Product details')) + '" style="--i:2">' +
    '<div class="pdp-details__inner container container--wide">' +
      '<h2 class="pdp-details__heading">' + escapeHtml(t('Details')) + '</h2>' +
      (d.description ? paragraphs(d.description, 'pdp-details__lead') : '') +
      '<div class="pdp-details__cols">' +
        '<div class="pdp-details__left">' +
          (attrs.length
            ? '<div class="pdp-details__specs-block">' +
                '<h3 class="pdp-details__sub-heading">' + escapeHtml(t('Specification')) + '</h3>' +
                '<dl class="pdp-specs">' +
                  attrs.map(a => '<div class="pdp-specs__row"><dt>' + escapeHtml(a.name) + '</dt><dd>' + escapeHtml(a.value) + '</dd></div>').join('') +
                '</dl>' +
              '</div>'
            : '') +
        '</div>' +
        '<div class="pdp-details__right">' +
          (fulfil || note
            ? '<div class="pdp-details__shipping-block">' +
                '<h3 class="pdp-details__sub-heading">' + escapeHtml(d.fulfillmentType === 'QR_PICKUP' ? t('Pickup & returns') : t('Shipping & returns')) + '</h3>' +
                (fulfil ? '<p class="pdp-details__shipping-text">' + escapeHtml(fulfil) + '</p>' : '') +
                sessions.filter(s => s.instruction).slice(0, 3).map(s => '<p class="pdp-details__shipping-text">' + escapeHtml(s.instruction) + '</p>').join('') +
                (note ? paragraphs(note, 'pdp-details__shipping-text') : '') +
              '</div>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>';
}

function recsHtml(related) {
  if (!related.length) return '';
  return '<section class="pdp-recs l-reveal" aria-label="' + escapeHtml(t('You may also like')) + '" style="--i:3">' +
    '<div class="pdp-recs__inner container container--wide">' +
      '<h2 class="pdp-recs__heading">' + escapeHtml(t('You may also like')) + '</h2>' +
      '<div class="pdp-recs__rail">' +
        related.map(r =>
          '<a class="pdp-rec-card" href="/product?id=' + encodeURIComponent(r.slug) + '" data-rec="' + escapeHtml(r.slug) + '">' +
            '<div class="pdp-rec-card__media">' + cardImg(r) + '</div>' +
            '<div class="pdp-rec-card__body">' +
              '<span class="pdp-rec-card__cat">' + escapeHtml(r.category) + '</span>' +
              '<h3 class="pdp-rec-card__title">' + escapeHtml(r.name) + '</h3>' +
              '<span class="pdp-rec-card__price">' + escapeHtml(money(r.price, r.currency)) + '</span>' +
            '</div>' +
          '</a>').join('') +
      '</div>' +
    '</div>' +
  '</section>';
}

function pageHtml(d) {
  return '<div class="pdp__page">' +
    '<div class="pdp-return container container--wide"><a class="collection-back" href="/shop">' + SVG.prev + '<span>' + escapeHtml(t('Back to shop')) + '</span></a></div>' +
    '<div class="container container--wide">' +
      crumbsHtml(d) +
      '<div class="pdp__grid">' + galleryHtml() + buyHtml(d) + '</div>' +
    '</div>' +
    detailsHtml(d) +
    recsHtml(view.related) +
  '</div>';
}

function buybarHtml(d) {
  const thumb = view.gallery.find(m => m.type === 'IMAGE')?.url || view.card?.image || '';
  return '<div class="shop-buybar" data-buybar aria-hidden="true" inert>' +
    (thumb ? '<img class="shop-buybar__thumb" src="' + escapeHtml(thumb) + '" alt="" width="44" height="44" decoding="async">' : '') +
    '<div class="shop-buybar__info">' +
      '<span class="shop-buybar__title">' + escapeHtml(d.title) + '</span>' +
      '<span class="shop-buybar__price" data-buybar-price>' + escapeHtml(priceOf(d, sku()).now) + '</span>' +
    '</div>' +
    '<button class="btn btn--primary btn--md pdp-buy__add shop-buybar__add" type="button" data-buybar-add>' +
      '<span class="pdp-buy__add-glyph" aria-hidden="true">' + ICONS.bagSmall + '</span><span>' + escapeHtml(addLabel()) + '</span>' +
    '</button>' +
  '</div>';
}

function unavailableHtml(title, text, retry) {
  return '<div class="container container--wide" style="padding-block:120px"><h1>' + escapeHtml(title) + '</h1>' +
    '<p class="rf-empty__desc">' + escapeHtml(text) + '</p>' +
    (retry ? '<a class="btn btn--ghost" href="' + escapeHtml(location.href) + '">' + escapeHtml(t('Try again')) + '</a> ' : '') +
    '<a class="btn btn--primary" href="/shop">' + escapeHtml(t('Explore the shop')) + '</a></div>';
}

// ── gallery ───────────────────────────────────────────────────────────────────
function setView(i) {
  const n = view.gallery.length;
  if (n < 2) return;
  view.view = ((i % n) + n) % n;
  const frame = qs('[data-hero-frame]', root);
  if (frame) frame.innerHTML = heroHtml();
  qsa('[data-thumb]', root).forEach(b => {
    const on = Number(b.dataset.thumb) === view.view;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// a horizontal swipe on the frame changes the view and suppresses the click that follows
function bindSwipe(frame) {
  let x0 = null, swiped = false;
  frame.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { x0 = e.clientX; swiped = false; } });
  frame.addEventListener('pointerup', e => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) >= SWIPE_PX) { swiped = true; setView(view.view + (dx < 0 ? 1 : -1)); }
  });
  frame.addEventListener('pointercancel', () => { x0 = null; });
  frame.addEventListener('click', e => { if (swiped) { swiped = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

// ── options / guard / buy state ───────────────────────────────────────────────
function setGuard(message, optionId = null) {
  view.flag = optionId;
  const guard = qs('[data-guard]', root);
  if (guard) { guard.textContent = message || ''; guard.hidden = !message; }
  qsa('.pdp-variant', root).forEach(v => {
    if (optionId && v.dataset.variant === optionId) bump(v, 'is-flagged'); else v.classList.remove('is-flagged');
  });
}

function paintBuy() {
  const d = view.detail;
  const cap = qtyCap(d, sku());
  if (view.qty > cap) view.qty = cap;
  const price = qs('[data-price]', root);
  if (price) price.innerHTML = priceHtml();
  const qtyVal = qs('[data-qty-val]', root);
  if (qtyVal) qtyVal.textContent = String(view.qty);
  const dec = qs('[data-qty-dec]', root), inc = qs('[data-qty-inc]', root);
  if (dec) dec.disabled = soldOut() || view.qty <= 1;
  if (inc) inc.disabled = soldOut() || view.qty >= cap;
  const blocked = bundle() || soldOut() || view.busy;
  qsa('[data-pdp-add], [data-buybar-add]').forEach(button => {
    button.disabled = blocked;
    button.setAttribute('aria-busy', String(view.busy));
    const label = button.querySelector('[data-add-label]') || button.lastElementChild;
    if (label && label.textContent !== t('Added ✓')) label.textContent = addLabel();
  });
  const barPrice = qs('[data-buybar-price]');
  if (barPrice) barPrice.textContent = priceOf(d, sku()).now;
}

function pick(optionId, valueId) {
  if (!valueAvailable(view.detail, view.picked, optionId, valueId)) return;
  view.picked = pickValue(view.detail, view.picked, optionId, valueId);
  const host = qs('[data-variants]', root);
  const focused = document.activeElement?.closest?.('[data-opt]');
  host.innerHTML = view.detail.options.map(optionHtml).join('');
  if (focused) qs('[data-opt="' + CSS.escape(optionId) + '"][data-val="' + CSS.escape(valueId) + '"]', host)?.focus({ preventScroll: true });
  if (view.flag) setGuard('');
  paintBuy();
}

function setQty(n) {
  view.qty = Math.min(qtyCap(view.detail, sku()), Math.max(1, n | 0 || 1));
  paintBuy();
}

// ── add to bag / wishlist ─────────────────────────────────────────────────────
async function addToBag(fromEl) {
  const d = view.detail;
  if (view.busy || bundle() || soldOut()) return;
  const chosen = sku();
  if (!chosen) {
    const missing = firstMissing(d, view.picked);
    const option = d.options.find(o => o.optionId === missing);
    setGuard(t('Please choose a {option}', { option: option ? t(option.optionName).toLowerCase() : t('option') }), missing);
    const row = missing && qs('[data-variant="' + CSS.escape(missing) + '"]', root);
    if (row && fromEl && fromEl.closest('[data-buybar]')) row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const first = row && qs('[data-opt]:not(.is-oos)', row);
    if (first) first.focus({ preventScroll: true });
    return;
  }
  if (!state.session()) { location.assign(signInHref()); return; }
  view.busy = true;
  setGuard('');
  paintBuy();
  try {
    const id = await cart.addProduct(d.productId, chosen.skuId, view.qty);
    if (!id) return;
    view.busy = false;
    paintBuy();
    const label = fromEl?.querySelector('[data-add-label]') || fromEl?.lastElementChild;
    if (label) {
      clearTimeout(label._addedTimer); label.textContent = t('Added ✓'); fromEl.classList.remove('is-added'); reflow(fromEl); fromEl.classList.add('is-added');
      label._addedTimer = setTimeout(() => { if (label.isConnected && label.textContent === t('Added ✓')) { fromEl.classList.remove('is-added'); label.textContent = addLabel(); } }, 1200);
    }
    toastAdded(d.title, { link: t('Checkout'), onLink: () => location.assign('/checkout') });
    openDrawer(fromEl || qs('[data-pdp-add]', root));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) { location.assign(signInHref()); return; }
    setGuard((error && error.message) || t('This could not be added to your bag. Try again.'));
  } finally {
    view.busy = false;
    paintBuy();
  }
}

function paintHeart() {
  const on = wishlist.has(view.detail.productId);
  qsa('[data-pdp-wish]', root).forEach(b => {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? t('Remove from wishlist') : t('Add to wishlist'));
  });
}

function toggleWish() {
  const id = view.detail.productId;
  const before = wishlist.has(id);
  wishlist.toggle(id);
  paintHeart();
  if (before !== wishlist.has(id)) qsa('[data-pdp-wish]', root).forEach(b => bump(b, 'is-pop'));
}

// ── sticky buy bar: shown while the inline add button is out of the viewport ──
function mountBuybar(d) {
  buybar = el(buybarHtml(d));
  root.appendChild(buybar);
  const inline = qs('[data-pdp-add]', root);
  if (!inline || !('IntersectionObserver' in window)) return;
  buybarObserver = new IntersectionObserver(entries => {
    const shown = !entries[0].isIntersecting;
    buybar.classList.toggle('is-shown', shown);
    buybar.setAttribute('aria-hidden', String(!shown));
    buybar.inert = !shown;
  }, { threshold: 0 });
  buybarObserver.observe(inline);
}

// ── events ────────────────────────────────────────────────────────────────────
function onRootClick(e) {
  const t = e.target;
  const thumb = t.closest('[data-thumb]');
  if (thumb) { setView(Number(thumb.dataset.thumb)); return; }
  if (t.closest('[data-hero-prev]')) { setView(view.view - 1); return; }
  if (t.closest('[data-hero-next]') || t.closest('[data-hero-frame]')) { setView(view.view + 1); return; }

  const value = t.closest('[data-opt]');
  if (value) { if (!value.classList.contains('is-oos')) pick(value.dataset.opt, value.dataset.val); return; }

  if (t.closest('[data-qty-dec]')) { setQty(view.qty - 1); return; }
  if (t.closest('[data-qty-inc]')) { setQty(view.qty + 1); return; }
  if (t.closest('[data-pdp-add]')) { addToBag(t.closest('[data-pdp-add]')); return; }
  if (t.closest('[data-buybar-add]')) { addToBag(t.closest('[data-buybar-add]')); return; }
  if (t.closest('[data-pdp-wish]')) { toggleWish(); }
}

function onRootKeydown(e) {
  if (!e.target.closest) return;
  // left / right on the gallery stage walk the views
  if (e.target.closest('.pdp-gallery__stage')) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setView(view.view + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setView(view.view - 1); }
    return;
  }
  // and walk an option's values
  const value = e.target.closest('[data-opt]');
  if (!value || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  const values = qsa('[data-opt]', value.parentElement);
  const i = values.indexOf(value);
  e.preventDefault();
  values[(i + (e.key === 'ArrowRight' ? 1 : values.length - 1)) % values.length].focus();
}

function setMeta(d) {
  document.title = d.title + ' | LLOUD';
  const description = (d.description || d.title).replace(/\s+/g, ' ').slice(0, 160);
  for (const [attr, key, value] of [['name', 'description', description], ['property', 'og:title', document.title], ['property', 'og:description', description]]) {
    let node = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!node) { node = document.createElement('meta'); node.setAttribute(attr, key); document.head.append(node); }
    node.content = value;
  }
}

// ── mount ─────────────────────────────────────────────────────────────────────
async function load(id) {
  const [detail] = await Promise.all([state.loadDetail(id), state.hydrate(['products'])]);
  return detail;
}

async function mount() {
  root = qs('[data-pdp]');
  if (!root) return;
  const ids = new URLSearchParams(location.search).getAll('id');
  const id = ids.length === 1 && ids[0].trim() ? ids[0].trim() : null;
  const done = html => { root.innerHTML = html; root.setAttribute('aria-busy', 'false'); };
  if (!id) { done(unavailableHtml(t('This piece is unavailable.'), t('It may have moved, or the link may be out of date.'))); return; }
  let d;
  try {
    d = await load(id);
  } catch (error) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    document.title = (missing ? t('Product unavailable') : t('Product')) + ' | LLOUD';
    done(missing
      ? unavailableHtml(t('This piece is unavailable.'), t('It may have moved, or the link may be out of date.'))
      : unavailableHtml(t('This piece could not load.'), (error && error.message) || t('The shop did not answer. Try again in a moment.'), true));
    return;
  }

  view.detail = d;
  // The page wears the piece's collection (its Creator Studio tag) as on lloud.club, never kept for other pages.
  const world = collectionOf(d.tags);
  if (world && getCollection() !== world) setCollection(world, { persist: false });
  view.card = state.product(d.productId);
  view.gallery = galleryItems(d.media);
  if (!view.gallery.length && view.card?.image) view.gallery = [{ type: 'IMAGE', url: view.card.image }];
  view.related = state.products().filter(p => p.slug !== d.productId && !p.soldOut).slice(0, RELATED);
  view.picked = initialPicks(d);

  setMeta(d);
  done(pageHtml(d));
  root.dataset.product = d.productId;

  root.addEventListener('click', onRootClick);
  root.addEventListener('keydown', onRootKeydown);
  const frame = qs('[data-hero-frame]', root);
  if (frame) bindSwipe(frame);

  mountBuybar(d);
  paintBuy();
  onWishlistChange(() => paintHeart());
}

await mount();

export { view as state };
