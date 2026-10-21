// js/drawer.js — the bag drawer from Bag.dc.html (port of Ztor cart.js DRAWER + wishlist-in-cart + sheet),
// mounted on every page. Lines · steppers · remove with the leaving animation · wishlist section with
// 4s undo chips · "See all" sheet · subtotal / shipping / total · Checkout link · empty state ·
// Escape / scrim close · focus trap. Re-renders on cart:change and wishlist:change.
//   mountDrawer() · openDrawer(fromEl) · closeDrawer() · toggleDrawer(fromEl) · isDrawerOpen()
//   openWishlistSheet(fromEl) · closeWishlistSheet()
// Checkout is a page (/checkout): the CTA is a link, the drawer has one view.
// The bag is the fan's Ztor cart (cart.js → ztor/state.js): lines carry their SKU label, their own
// maximum (purchase limit / stock) and a status (a sold-out line stays, left out of the subtotal).
// The wishlist stays in this browser: Ztor products (state.products()) and the runway's pieces (data.js).

import { cart, onCartChange } from './cart.js';
import { wishlist, onWishlistChange } from './wishlist.js';
import { getProduct as runwayProduct, getCollection } from './data.js';
import * as state from './ztor/state.js';
import { ApiError } from './ztor/api.js';
import { signInHref } from './ztor/session.js';
import { money } from './ztor/map.js';
import { lineStatusText } from './ztor/commerce.js';
import { escapeHtml, el, qsa, focusables, trapTab, reflow, prefersReducedMotion, readString, writeString, ICONS } from './util.js';

const COLLAPSE_KEY = 'lisa_cart_wishlist_collapsed';
const CHIP_TTL = 4000;
const MAX_ROWS = 3;
const LEAVE_FALLBACK_MS = 320;
// inactive overlays leave the tree ([hidden]) after their exit transition: Safari 26 samples a
// visibility:hidden fixed layer (knowledge/mobile-ios/safari26-toolbar.md rule a)
const CART_EXIT_MS = 360;    // kit.css .ztor-cart__panel transform transition
const SHEET_EXIT_MS = 280;   // kit.css --dur-panel-exit

let root = null, panel = null, body = null, foot = null, titleCount = null;
let sheet = null, sheetPanel = null, sheetList = null, sheetCount = null;
let opener = null, sheetOpener = null;
let open = false, sheetOpen = false;
let hideTimer = 0, sheetHideTimer = 0;
const leaving = new Set();          // line ids mid leave-animation (re-applied on re-render)
const justAdded = new Map();        // slug → { lineId, timer }   "Added · Undo"
const removedChip = new Map();      // slug → { addedAt, index, timer }   "Removed · Undo"
let busy = false;                   // a bag change is on its way to the shop: the steppers wait
let failure = '';                   // the last change the shop refused, shown above the lines
let productsAsked = false;          // the catalogue is read once, for the wishlist's Ztor pieces

/** A wishlisted id as a row: a Ztor product (its page picks the SKU) or one of the runway's pieces (shown in the shop). */
function wishProduct(slug) {
  const ztor = state.product(slug);
  if (ztor) return { slug, name: ztor.name, price: ztor.price, currency: ztor.currency, image: ztor.image, ztor: true };
  const p = runwayProduct(slug);
  if (!p) return null;
  const col = getCollection(p.collection);
  return { slug, name: (col ? col.token + ' ' : '') + p.name, price: p.price, currency: 'HKD', image: p.image, ztor: false };
}

// ── templates ────────────────────────────────────────────────────────────────
function shellHtml() {
  return '<div class="ztor-cart" data-view="cart" aria-hidden="true" hidden>' +
    '<div class="ztor-cart__overlay" data-cart-close></div>' +
    '<div class="ztor-cart__panel" role="dialog" aria-modal="true" aria-label="Bag">' +
      '<div class="ztor-cart__stage">' +
        '<section class="ztor-cart__view" data-view-cart>' +
          '<header class="ztor-cart__head">' +
            '<h2 class="ztor-cart__title">Bag<span class="ztor-cart__title-count" data-cart-count></span></h2>' +
            '<button class="ztor-cart__close" type="button" aria-label="Close" data-cart-close>' +
              '<span class="ztor-cart__close-icon" aria-hidden="true">' + ICONS.close + '</span>' +
            '</button>' +
          '</header>' +
          '<div class="ztor-cart__body" data-cart-body></div>' +
          '<footer class="ztor-cart__foot" data-cart-foot></footer>' +
        '</section>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function sheetHtml() {
  return '<div class="ds-drawer ds-drawer--overcart" data-ds-drawer="cart-wishlist" data-ds-drawer-self-managed aria-hidden="true" hidden>' +
    '<div class="ds-drawer__scrim" data-sheet-close></div>' +
    '<aside class="ds-drawer__panel" role="dialog" aria-modal="true" aria-label="Wishlist" tabindex="-1">' +
      '<header class="ds-drawer__head">' +
        '<h2 class="zcw-sheet__title">Wishlist<span class="zcw-sheet__title-count" data-sheet-count></span></h2>' +
        '<button class="ds-drawer__close" type="button" aria-label="Close" data-sheet-close>' + ICONS.close + '</button>' +
      '</header>' +
      '<div class="ds-drawer__body"><div class="zcw-sheet__list" data-sheet-list></div></div>' +
    '</aside>' +
  '</div>';
}

function lineHtml(it) {
  const img = it.image ? '<img src="' + escapeHtml(it.image) + '" alt="" loading="lazy" decoding="async">' : '';
  const status = lineStatusText(it.status);
  const atMax = !!status || (it.max != null && it.qty >= it.max);
  const off = busy ? ' disabled' : '';
  return '<div class="ztor-cart-line' + (leaving.has(it.id) ? ' is-leaving' : '') + '" data-line="' + escapeHtml(it.id) + '"' + (status ? ' data-status="' + escapeHtml(it.status) + '"' : '') + '>' +
    '<span class="ztor-cart-line__media">' + img + '</span>' +
    '<div class="ztor-cart-line__main">' +
      '<h3 class="ztor-cart-line__title">' + escapeHtml(it.title + (it.size ? ' (' + it.size + ')' : '')) + '</h3>' +
      '<span class="ztor-cart-line__price">' + escapeHtml(money(it.price, it.currency)) + (status ? ' · ' + escapeHtml(status) : '') + '</span>' +
      '<span class="ztor-cart-line__stepper">' +
        '<button class="ztor-cart-step" type="button" data-dec aria-label="Decrease quantity"' + off + '>' + ICONS.minus + '</button>' +
        '<span class="ztor-cart-line__qty" aria-label="Quantity">' + it.qty + '</span>' +
        '<button class="ztor-cart-step" type="button" data-inc aria-label="Increase quantity"' + (busy || atMax ? ' disabled' : '') + '>' + ICONS.plus + '</button>' +
      '</span>' +
    '</div>' +
    '<div class="ztor-cart-line__aside">' +
      '<button class="ztor-cart-line__remove" type="button" data-rm aria-label="Remove"' + off + '>' + ICONS.trash + '</button>' +
      '<span class="ztor-cart-line__line-total">' + (status ? '' : escapeHtml(money(it.price * it.qty, it.currency))) + '</span>' +
    '</div>' +
  '</div>';
}

function failureHtml() {
  return failure ? '<p class="cc-callout cc-callout--error" role="alert" data-cart-error>' + escapeHtml(failure) + '</p>' : '';
}

function emptyHtml() {
  return '<div class="ztor-cart__empty">' +
    '<span class="ztor-cart__empty-icon" aria-hidden="true">' + ICONS.bagEmpty + '</span>' +
    '<span class="ztor-cart__empty-title">Your bag is empty</span>' +
    '<span class="ztor-cart__empty-desc">Add the pieces you want from this season and they will wait for you here.</span>' +
    '<a class="ztor-cart__empty-cta" href="/shop">Explore the shop</a>' +
  '</div>';
}

// wishlist rows = the live wishlist, with "Removed" chip rows re-inserted at their old index
function wishRows() {
  const ids = wishlist.ids();
  removedChip.forEach((chip, slug) => {
    if (!ids.includes(slug)) ids.splice(Math.min(chip.index, ids.length), 0, slug);
  });
  return ids.filter(slug => !!wishProduct(slug));
}

function wishRowHtml(slug, { inSheet = false } = {}) {
  const p = wishProduct(slug);
  if (!p) return '';
  const added = justAdded.has(slug);
  const removed = removedChip.has(slug);
  const inBag = cart.getItems().some(it => it.slug === slug);
  const rowCls = added ? ' zcw-row--added' : removed ? ' zcw-row--removed' : '';
  let inner;
  if (added || removed) {
    inner = '<div class="zcw-chip"><span class="zcw-chip__label">' + (added ? 'Added' : 'Removed') + '</span>' +
      '<button type="button" class="zcw-chip__undo" data-zcw-undo aria-label="Undo">Undo</button></div>';
  } else {
    // a Ztor product's options are picked on its page; the runway's pieces are not sold here, the shop is
    const addCtl = inBag
      ? '<span class="zcw-row__incart">In bag</span>'
      : p.ztor
        ? '<a class="zcw-row__add" href="/product?id=' + encodeURIComponent(slug) + '" data-zcw-pick>Add to bag</a>'
        : '<a class="zcw-row__add" href="/shop" data-zcw-pick>Shop</a>';
    inner = '<span class="zcw-row__media"><img src="' + escapeHtml(p.image) + '" alt="" loading="lazy" decoding="async"></span>' +
      '<span class="zcw-row__info">' +
        '<span class="zcw-row__name">' + escapeHtml(p.name) + '</span>' +
        '<span class="zcw-row__price">' + escapeHtml(money(p.price, p.currency)) + '</span>' +
      '</span>' +
      (inSheet ? '<button class="zcw-row__heart is-on" type="button" aria-pressed="true" aria-label="Remove from wishlist" data-zcw-unheart>' + ICONS.heartSmall + '</button>' : '') +
      addCtl;
  }
  return '<div class="zcw-row' + rowCls + '" data-zcw="' + escapeHtml(slug) + '">' + inner + '</div>';
}

function wishSectionHtml(hasLines) {
  const rows = wishRows();
  if (!rows.length) return '';
  const n = wishlist.count();
  const collapsed = readString(COLLAPSE_KEY) === '1';
  return '<div class="zcw-sec' + (hasLines ? ' zcw-sec--filled' : '') + (collapsed ? ' zcw-sec--collapsed' : '') + '" data-zcw-sec>' +
    '<div class="zcw-sec__header">' +
      '<button class="zcw-sec__toggle" type="button" aria-expanded="' + (!collapsed) + '" aria-label="' + (collapsed ? 'Expand' : 'Collapse') + ' wishlist" data-zcw-toggle>' +
        '<span class="zcw-sec__header-icon" aria-hidden="true">' + ICONS.heartSmall + '</span>' +
        '<span class="zcw-sec__header-title">Wishlist</span>' +
        '<span class="zcw-sec__header-count" aria-hidden="true"> · <span class="zcw-sec__count">' + n + '</span></span>' +
        '<span class="zcw-sec__chevron" aria-hidden="true">' + ICONS.chevronDown + '</span>' +
      '</button>' +
      '<button class="zcw-sec__see-all" type="button" aria-label="See all wishlist items" data-zcw-see-all><span>See all</span> · <span class="zcw-sec__see-all-count">' + n + '</span></button>' +
    '</div>' +
    '<div class="zcw-sec__list">' + rows.slice(0, MAX_ROWS).map(s => wishRowHtml(s)).join('') + '</div>' +
  '</div>';
}

function footHtml() {
  if (!cart.lineCount()) return '';
  const t = cart.totals();
  return '<div class="ztor-cart__summary">' +
    '<div class="ztor-cart__sum-row ztor-cart__sum-row--total"><span>Subtotal</span><span>' + escapeHtml(money(t.subtotal, t.currency)) + '</span></div>' +
  '</div>' +
  '<a class="ztor-cart__cta" href="/checkout" data-cart-checkout>Checkout</a>' +
  '<p class="ztor-cart__foot-note">' + escapeHtml(t.note) + '</p>';
}

// ── render ───────────────────────────────────────────────────────────────────
function focusDescriptor() {
  const a = document.activeElement;
  if (!a || !root || !root.contains(a)) return null;
  const line = a.closest('[data-line]');
  const row = a.closest('[data-zcw]');
  const ctl = ['data-inc', 'data-dec', 'data-rm', 'data-zcw-add', 'data-zcw-undo', 'data-zcw-toggle', 'data-zcw-see-all'].find(k => a.hasAttribute(k));
  if (!ctl) return null;
  return { line: line ? line.dataset.line : null, row: row ? row.dataset.zcw : null, ctl };
}
function restoreFocus(d) {
  if (!d) return;
  let scope = body;
  if (d.line) scope = body.querySelector('[data-line="' + CSS.escape(d.line) + '"]');
  else if (d.row) scope = body.querySelector('[data-zcw="' + CSS.escape(d.row) + '"]');
  const node = scope && scope.querySelector('[' + d.ctl + ']');
  if (node) node.focus({ preventScroll: true });
  else { const c = root.querySelector('.ztor-cart__close'); if (c && open) c.focus({ preventScroll: true }); }
}

export function renderDrawer() {
  if (!root) return;
  const keep = focusDescriptor();
  const items = cart.getItems();
  const n = cart.count();
  titleCount.textContent = n ? ' (' + n + ')' : '';
  body.innerHTML =
    failureHtml() +
    (items.length ? '<div class="ztor-cart__items">' + items.map(lineHtml).join('') + '</div>' : emptyHtml()) +
    wishSectionHtml(items.length > 0);
  foot.innerHTML = footHtml();
  if (sheet) renderSheet();
  restoreFocus(keep);
}

function renderSheet() {
  const rows = wishRows();
  sheetCount.textContent = ' (' + wishlist.count() + ')';
  sheetList.innerHTML = rows.length
    ? rows.map(s => wishRowHtml(s, { inSheet: true })).join('')
    : '<p class="ztor-cart__empty-desc">Nothing saved yet.</p>';
}

// ── remove: animate first, mutate after (cart.js:920-929) ─────────────────────
// a bag change on its way to the shop: one at a time; a refusal is said above the lines, a lost sign-in signs in again
function change(run) {
  if (busy) return Promise.resolve(false);
  busy = true;
  failure = '';
  renderDrawer();
  return Promise.resolve()
    .then(run)
    .catch(error => {
      if (error instanceof ApiError && error.status === 401) { location.assign(signInHref()); return false; }
      failure = (error && error.message) || 'Your bag could not be changed. Try again.';
      return false;
    })
    .finally(() => { busy = false; renderDrawer(); });
}

function animateRemove(id) {
  const line = body.querySelector('[data-line="' + CSS.escape(id) + '"]');
  if (!line || prefersReducedMotion()) { change(() => cart.remove(id)); return; }
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    leaving.delete(id);
    change(() => cart.remove(id));
  };
  leaving.add(id);
  line.classList.add('is-leaving');
  line.addEventListener('animationend', commit, { once: true });
  setTimeout(commit, LEAVE_FALLBACK_MS);
}

// ── wishlist-in-cart mechanics (cart.js:304-339) ──────────────────────────────
function armChip(map, slug, entry) {
  const prev = map.get(slug);
  if (prev && prev.timer) clearTimeout(prev.timer);
  entry.timer = setTimeout(() => { map.delete(slug); renderDrawer(); }, CHIP_TTL);
  map.set(slug, entry);
}
function unheart(slug) {
  const entry = wishlist.get(slug);
  if (!entry) return;
  const index = wishlist.ids().indexOf(slug);
  if (wishlist.remove(slug)) { armChip(removedChip, slug, { addedAt: entry.addedAt, index }); renderDrawer(); }
}
function undo(slug) {
  const added = justAdded.get(slug);
  if (added) {
    change(() => cart.remove(added.lineId)).then(() => { clearTimeout(added.timer); justAdded.delete(slug); renderDrawer(); });
    return;
  }
  const removed = removedChip.get(slug);
  if (removed) {
    if (wishlist.add(slug, removed.addedAt)) { clearTimeout(removed.timer); removedChip.delete(slug); renderDrawer(); }
  }
}

// ── open / close ─────────────────────────────────────────────────────────────
export function isDrawerOpen() { return open; }

// an opener that has gone (a hidden toast link, a closed size step) cannot take focus back:
// its OWN opacity is ignored (hover-revealed controls become visible once focused)
function canTakeFocus(node) {
  if (!node || typeof node.focus !== 'function' || !node.isConnected) return false;
  if (node.offsetParent === null && getComputedStyle(node).position !== 'fixed') return false;
  for (let n = node.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  }
  return true;
}

export function openDrawer(fromEl) {
  mountDrawer();
  if (open) return;
  opener = fromEl || document.activeElement;
  // the wishlist may hold Ztor products: read the catalogue once, on the first open of a page that hasn't
  if (!productsAsked && wishlist.count() && !state.products().length) {
    productsAsked = true;
    state.hydrate(['products']).then(() => renderDrawer());
  }
  renderDrawer();
  open = true;
  clearTimeout(hideTimer);
  root.hidden = false;
  reflow(root);                  // the panel must start from translateX(100%)
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-open');
  qsa('.header__cart').forEach(b => b.setAttribute('aria-expanded', 'true'));
  requestAnimationFrame(() => {
    const c = root.querySelector('[data-view-cart] .ztor-cart__close');
    if (c) c.focus();
  });
  document.dispatchEvent(new CustomEvent('drawer:open'));
}

export function closeDrawer() {
  if (!root || !open) return;
  if (sheetOpen) closeWishlistSheet();
  open = false;
  root.classList.remove('is-open');
  root.setAttribute('aria-hidden', 'true');
  hideTimer = setTimeout(() => { root.hidden = true; }, prefersReducedMotion() ? 0 : CART_EXIT_MS);
  document.body.classList.remove('cart-open');
  qsa('.header__cart').forEach(b => b.setAttribute('aria-expanded', 'false'));
  document.dispatchEvent(new CustomEvent('drawer:close'));
  const back = canTakeFocus(opener) ? opener : document.querySelector('.bag-link');
  if (back) back.focus({ preventScroll: true });
  opener = null;
}

export function toggleDrawer(fromEl) {
  if (open) closeDrawer(); else openDrawer(fromEl);
}

export function openWishlistSheet(fromEl) {
  mountDrawer();
  if (sheetOpen) return;
  sheetOpener = fromEl || document.activeElement;
  renderSheet();
  sheetOpen = true;
  clearTimeout(sheetHideTimer);
  sheet.hidden = false;
  reflow(sheet);
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    const list = focusables(sheetPanel);
    (list[0] || sheetPanel).focus();
  });
}

export function closeWishlistSheet() {
  if (!sheet || !sheetOpen) return;
  sheetOpen = false;
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  sheetHideTimer = setTimeout(() => { sheet.hidden = true; }, prefersReducedMotion() ? 0 : SHEET_EXIT_MS);
  if (sheetOpener && typeof sheetOpener.focus === 'function' && document.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true });
  sheetOpener = null;
}

// ── mount ────────────────────────────────────────────────────────────────────
function onClick(e) {
  const t = e.target;
  if (t.closest('[data-cart-close]')) { closeDrawer(); return; }
  if (t.closest('[data-sheet-close]')) { closeWishlistSheet(); return; }
  const line = t.closest('[data-line]');
  if (line) {
    const id = line.dataset.line;
    if (t.closest('[data-inc]')) { change(() => cart.setQty(id, cart.qtyOf(id) + 1)); return; }
    if (t.closest('[data-dec]')) { const q = cart.qtyOf(id) - 1; if (q <= 0) animateRemove(id); else change(() => cart.setQty(id, q)); return; }
    if (t.closest('[data-rm]')) { animateRemove(id); return; }
  }
  if (t.closest('[data-zcw-toggle]')) {
    const collapsed = readString(COLLAPSE_KEY) === '1';
    writeString(COLLAPSE_KEY, collapsed ? null : '1');
    renderDrawer();
    return;
  }
  if (t.closest('[data-zcw-see-all]')) { openWishlistSheet(t.closest('[data-zcw-see-all]')); return; }
  const row = t.closest('[data-zcw]');
  if (row) {
    const slug = row.dataset.zcw;
    if (t.closest('[data-zcw-undo]')) { undo(slug); return; }
    if (t.closest('[data-zcw-unheart]')) { unheart(slug); return; }
    if (t.closest('[data-zcw-pick]')) { closeDrawer(); return; }   // the link navigates to the product page
  }
  if (t.closest('[data-cart-checkout]')) { closeDrawer(); }         // the link navigates to /checkout
}

function onKeydown(e) {
  if (!open) return;
  if (e.key === 'Escape') {
    // Esc peels exactly one layer, innermost first (ds-drawer.md Section 6)
    if (sheetOpen) { e.stopImmediatePropagation(); closeWishlistSheet(); return; }
    if (document.body.classList.contains('ds-drawer-open')) return;   // a page-level ds-drawer is above us
    closeDrawer();
    return;
  }
  if (e.key === 'Tab') trapTab(e, sheetOpen ? sheetPanel : panel);
}

export function mountDrawer() {
  if (root) return root;
  root = el(shellHtml());
  panel = root.querySelector('.ztor-cart__panel');
  body = root.querySelector('[data-cart-body]');
  foot = root.querySelector('[data-cart-foot]');
  titleCount = root.querySelector('[data-cart-count]');
  sheet = el(sheetHtml());
  sheetPanel = sheet.querySelector('.ds-drawer__panel');
  sheetList = sheet.querySelector('[data-sheet-list]');
  sheetCount = sheet.querySelector('[data-sheet-count]');
  document.body.appendChild(root);
  document.body.appendChild(sheet);
  root.addEventListener('click', onClick);
  sheet.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown, true);   // capture: peel the sheet before anything else
  onCartChange(() => renderDrawer());
  onWishlistChange(() => renderDrawer());
  renderDrawer();
  return root;
}
