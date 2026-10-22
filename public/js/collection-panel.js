// Collection commerce extracted from the accepted shop. No legacy hero controller.
import { getCollection, setCollection, onCollectionChange, collectionData, COLLECTIONS } from './collection.js';
import { productsOf } from './data.js';
import * as state from './ztor/state.js';
import { wishlist, onWishlistChange } from './wishlist.js';
import { isDrawerOpen } from './drawer.js';




import { money, escapeHtml, qs, qsa, bump, trapTab, prefersReducedMotion, readJSON, writeJSON, ICONS } from './util.js';

const PANEL_MS = 520;    // --l-d2: the sheet's slide
const FILTER_ALL = 'All';



const panel = qs('[data-panel]');
const sheet = qs('[data-sheet]', panel);
const sheetScroll = qs('[data-sheet-scroll]', panel);
const grid = qs('[data-grid]', panel);
const filterBar = qs('[data-filter]', panel);
const noteEl = qs('[data-note]', panel);

let cats = [];               // active categories; empty = All
let panelOpen = false;
let panelClosePending = false;
let opener = null;
let hideTimer = 0;
let sizing = null;           // slug whose size step is open
let lastDrawerClose = -Infinity; // only an actual drawer close may suppress the sheet's Escape

// ── hero copy ────────────────────────────────────────────────────────────────
// the slide-over wears the active collection (the cards carry their own copy, painted once below)
function paintWorld(col) {
  noteEl.textContent = col.preview ? 'Presale interest · Preview only' : col.pieces + ' pieces · ' + col.window;
  filterBar.hidden = Boolean(col.preview);
  sheet.querySelector('#m-sheet-title').textContent = col.name;
}

// ── the grid ─────────────────────────────────────────────────────────────────
function sizeChipHtml(s) {
  const oos = s.inStock === false;
  return '<button class="pdp-size-chip' + (oos ? ' is-oos' : '') + '" type="button" role="radio" aria-checked="false" data-vval="' + escapeHtml(s.label) + '"' +
    (oos ? ' disabled aria-label="' + escapeHtml(s.label) + ', out of stock"' : '') + '>' +
    '<span class="pdp-size-chip__label">' + escapeHtml(s.label) + '</span>' +
    '<span class="pdp-size-chip__oos"' + (oos ? '' : ' hidden') + ' aria-hidden="true"></span>' +
  '</button>';
}

function cardHtml(p, col) {
  const wished = wishlist.has(p.slug);
  // The runway's pieces are LLOUD's showcase, not items in the artist's Ztor shop: cards lead to the shop.
  return '<a class="shop-card" href="/shop" data-id="' + escapeHtml(p.slug) + '" data-cat="' + escapeHtml(p.category) + '" data-name="' + escapeHtml(p.name) + '">' +
    '<div class="shop-card__media">' +
      '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" width="600" height="600" loading="lazy" decoding="async">' +
      '<span class="rf-flag rf-flag--neutral">MEMBER −10%</span>' +
      '<button class="rf-wish" type="button" aria-pressed="' + wished + '" aria-label="' + (wished ? 'Remove from wishlist' : 'Add to wishlist') + '" data-wish>' + ICONS.heart + '</button>' +
    '</div>' +
    '<div class="shop-card__body">' +
      '<span class="shop-card__cat">' + escapeHtml(p.category) + '</span>' +
      '<h3 class="shop-card__title"><span class="l-token">' + escapeHtml(col.token) + '</span> ' + escapeHtml(p.name) + '</h3>' +
      '<div class="shop-card__foot">' +
        '<span class="shop-card__price">' + escapeHtml(money(p.price)) + '</span>' +
        '<button class="shop-card__qa" type="button" data-add aria-label="Shop LLOUD pieces">' +
          '<span class="shop-card__qa-icon" aria-hidden="true">' + ICONS.bagSmall + '</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    (p.sized
      ? '<div class="shop-card__sizes" hidden><div class="pdp-variant__opts pdp-variant__opts--sizes" role="radiogroup" aria-label="Size">' + p.sizes.map(sizeChipHtml).join('') + '</div></div>'
      : '') +
  '</a>';
}

function emptyHtml() {
  return '<div class="rf-empty">' +
    '<span class="rf-empty__icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6"></circle><path d="M15.6 15.6L20 20"></path></svg></span>' +
    '<span class="rf-empty__title">Nothing in this filter yet</span>' +
    '<span class="rf-empty__desc">Try another category, or come back later.</span>' +
  '</div>';
}

function visibleProducts() {
  const list = productsOf(getCollection());
  return cats.length ? list.filter(p => cats.includes(p.category)) : list;
}

function syncFilter() {
  qsa('.shop-filter__item', filterBar).forEach(b => {
    const on = b.dataset.cat === FILTER_ALL ? cats.length === 0 : cats.includes(b.dataset.cat);
    b.classList.toggle('shop-filter__item--active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function presaleHtml(col) {
  const saved = readJSON('lisa.presale-interest.' + col.id, null);
  const email = typeof saved?.email === 'string' ? saved.email : '';
  return `<div class="collection-presale">
    <button class="btn btn--primary btn--lg" type="button" data-presale-open aria-expanded="false" aria-controls="presale-form"><span data-presale-label>${email ? 'Edit presale interest' : 'Join presale'}</span><span aria-hidden="true">↗</span></button>
    <form id="presale-form" data-presale-form data-collection="${escapeHtml(col.id)}" hidden>
      <p id="presale-help">Preview only. Your email stays in this browser. No reservation, payment or email is sent.</p>
      <label class="cc-field" for="presale-email"><span class="cc-field__label">Email address</span><input class="cc-field__input" id="presale-email" name="email" type="email" autocomplete="email" maxlength="254" required aria-describedby="presale-help presale-error" value="${escapeHtml(email)}"></label>
      <p id="presale-error" data-presale-error role="alert"></p>
      <div class="collection-presale-actions"><button class="btn btn--primary btn--md" type="submit">Save interest</button><button class="btn btn--ghost btn--md" type="button" data-presale-cancel>Cancel</button></div>
    </form>
    <p data-presale-status role="status">${email ? 'Interest saved in this browser only.' : ''}</p>
  </div>`;
}

function setPresaleOpen(open) {
  const form = qs('[data-presale-form]', grid);
  const button = qs('[data-presale-open]', grid);
  if (!form || !button) return;
  form.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  qs('[data-presale-error]', form).textContent = '';
  if (open) {
    const saved = readJSON('lisa.presale-interest.' + form.dataset.collection, null);
    form.elements.email.value = typeof saved?.email === 'string' ? saved.email : '';
  }
  (open ? form.elements.email : button).focus({ preventScroll: true });
  if (open) form.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function renderGrid() {
  const col = collectionData();
  const items = visibleProducts();
  sizing = null;
  grid.innerHTML = col.preview ? '<article class="collection-preview"><div class="collection-preview-image"><img src="' + escapeHtml(col.heroImage) + '" width="941" height="1671" alt="Black wrap maxi dress and 9 cm heels" /></div><div class="collection-preview-copy"><p class="collection-preview-eyebrow">COLLECTION 04 · FIRST LOOK</p><h3>' + escapeHtml(col.name) + '</h3><p class="collection-preview-manifesto">' + escapeHtml(col.manifesto) + '</p><dl><div><dt>The silhouette</dt><dd>Black wrap maxi dress</dd></div><div><dt>The finishing touch</dt><dd>Black 9 cm heels</dd></div></dl>' + presaleHtml(col) + '</div></article>' : items.length ? items.map(p => cardHtml(p, col)).join('') : emptyHtml();
  syncFilter();
}

// ── quick-add (shop-render.js:469-481 — sized pieces take the size step first) ─
function cardOf(slug) {
  return qs('.shop-card[data-id="' + slug + '"]', grid);
}

function closeSizing(refocus = true) {
  if (!sizing) return;
  const card = cardOf(sizing);
  sizing = null;
  if (!card) return;
  card.classList.remove('is-sizing');
  const box = qs('.shop-card__sizes', card);
  if (box) box.hidden = true;
  const qa = qs('[data-add]', card);
  if (qa) {
    qa.setAttribute('aria-expanded', 'false');
    if (refocus) qa.focus();
  }
}

// The runway's pieces are LLOUD's static catalogue (data.js), not products of the Ztor shop: the card's
// bag button is the way to the shop, where the pieces on sale are bought.
const SHOP_HREF = '/shop';
function commitAdd() {
  savePanelView();
  location.assign(SHOP_HREF);
}

function quickAdd() {
  commitAdd();
}

function toggleWish(card, btn) {
  const on = wishlist.toggle(card.dataset.id);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist');
  bump(btn, 'rf-wish--pop');
}

function syncHearts() {
  qsa('.shop-card', grid).forEach(card => {
    const b = qs('[data-wish]', card);
    if (!b) return;
    const on = wishlist.has(card.dataset.id);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist');
  });
}

// ── the slide-over ───────────────────────────────────────────────────────────
function panelUrl(open) {
  const url = new URL(location.href);
  url.searchParams.set('collection', getCollection());
  if (open) url.searchParams.set('view', 'collection');
  else url.searchParams.delete('view');
  return url;
}

function savePanelView() {
  if (!panelOpen) return;
  // Persist the selected chapter so returning from a product restores the same
  // collection independently of viewport size or previous scroll choreography.

  try { sessionStorage.setItem('lisa.collection-view.' + getCollection(), JSON.stringify({ cats, top:sheetScroll.scrollTop })); } catch (e) {}
}

export function openPanel(fromEl, { historyMode = 'push' } = {}) {
  if (panelOpen) return;
  const key = fromEl?.dataset.openCollection || getCollection();
  setCollection(key);
  paintWorld(collectionData());
  renderGrid();
  document.dispatchEvent(new CustomEvent('runway:select', { detail: { key } }));
  panelOpen = true;
  if (historyMode === 'push') {
    // The rail can change the world without changing the URL. Back must restore
    // the world underneath this sheet, not an older query parameter.
    history.replaceState(history.state, '', panelUrl(false));
    history.pushState({ ...history.state, lisaPanelEntry:true }, '', panelUrl(true));
  }
  clearTimeout(hideTimer);
  opener = fromEl || document.activeElement;
  panel.hidden = false;
  void panel.offsetWidth;                // the sheet must start from translateX(100%)
  panel.classList.add('is-open');
  document.body.classList.add('panel-open');
  requestAnimationFrame(() => {
    const close = qs('.l-close', sheet);
    if (close) close.focus();
  });
  document.dispatchEvent(new CustomEvent('panel:open'));
}

function hidePanel() {
  if (!panelOpen) return;
  savePanelView();
  panelOpen = false;
  closeSizing(false);
  panel.classList.remove('is-open');
  document.body.classList.remove('panel-open');
  hideTimer = setTimeout(() => { panel.hidden = true; }, prefersReducedMotion() ? 0 : PANEL_MS);
  // Restore background interactivity before returning focus to its opener.
  document.dispatchEvent(new CustomEvent('panel:close'));
  const returnTo = opener;
  // History traversal restores focus after popstate listeners run. Wait until
  // that browser step finishes, otherwise the first close loses focus to body.
  requestAnimationFrame(() => {
    if (!panelOpen && returnTo?.isConnected &&
        (document.activeElement === document.body || panel.contains(document.activeElement))) {
      returnTo.focus({ preventScroll: true });
    }
  });
  opener = null;
}

export function closePanel() {
  if (!panelOpen || panelClosePending) return;
  if (history.state?.lisaPanelEntry) { panelClosePending = true; history.back(); return; }
  history.replaceState(history.state, '', panelUrl(false));
  hidePanel();
}

window.addEventListener('popstate', () => {
  panelClosePending = false;
  const params = new URLSearchParams(location.search), id = params.get('collection');
  if (COLLECTIONS.some(col => col.id === id) && id !== getCollection()) {
    hidePanel();
    setCollection(id);
  }
  if (params.get('view') === 'collection') {
    openPanel(null, { historyMode:'none' });
    restorePanelView();
  }
  else hidePanel();
});
window.addEventListener('pagehide', savePanelView);

export function isPanelOpen() { return panelOpen; }

// ── wiring ───────────────────────────────────────────────────────────────────
qsa('[data-open-panel]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openPanel(e.currentTarget); }));
qsa('[data-close-panel]', panel).forEach(b => b.addEventListener('click', closePanel));

filterBar.addEventListener('click', e => {
  const b = e.target.closest('.shop-filter__item');
  if (!b) return;
  const cat = b.dataset.cat;
  if (cat === FILTER_ALL) cats = [];
  else cats = cats.includes(cat) ? cats.filter(c => c !== cat) : cats.concat(cat);
  renderGrid();
});

// every control inside a card is a button inside the card's <a>: stop the navigation for those,
// let a plain card click go to product.html?id=<slug>
grid.addEventListener('click', e => {
  const presale = e.target.closest('[data-presale-open]');
  if (presale) { setPresaleOpen(presale.getAttribute('aria-expanded') !== 'true'); return; }
  if (e.target.closest('[data-presale-cancel]')) { setPresaleOpen(false); return; }
  const card = e.target.closest('.shop-card');
  if (!card) return;
  const wish = e.target.closest('[data-wish]');
  if (wish) { e.preventDefault(); e.stopPropagation(); toggleWish(card, wish); return; }
  if (e.target.closest('[data-add]')) { e.preventDefault(); e.stopPropagation(); quickAdd(card); return; }
  const chip = e.target.closest('[data-vval]');
  if (chip) {
    e.preventDefault(); e.stopPropagation();
    if (chip.disabled || chip.classList.contains('is-oos')) return;
    commitAdd(card, chip.dataset.vval);
    return;
  }
  if (e.target.closest('.shop-card__sizes')) { e.preventDefault(); e.stopPropagation(); }
  if (!e.defaultPrevented) savePanelView();
});

grid.addEventListener('submit', e => {
  const form = e.target.closest('[data-presale-form]');
  if (!form) return;
  e.preventDefault();
  const col = collectionData();
  if (!col.preview || form.dataset.collection !== col.id) return;
  const input = form.elements.email;
  input.value = input.value.trim();
  if (!form.reportValidity()) return;
  if (!writeJSON('lisa.presale-interest.' + col.id, { email: input.value })) {
    qs('[data-presale-error]', form).textContent = 'Not saved. Browser storage is unavailable. Please try again.';
    form.scrollIntoView({ block: 'nearest' });
    return;
  }
  qs('[data-presale-label]', grid).textContent = 'Edit presale interest';
  setPresaleOpen(false);
  qs('[data-presale-status]', grid).textContent = 'Interest saved in this browser only.';
});

// arrow keys walk the size radios
grid.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const chip = e.target.closest('.pdp-size-chip');
  if (!chip) return;
  const chips = qsa('.pdp-size-chip:not([disabled])', chip.closest('.shop-card__sizes'));
  const i = chips.indexOf(chip);
  if (i < 0) return;
  e.preventDefault();
  chips[(i + (e.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length].focus();
});

// a click anywhere outside the open size step closes it
document.addEventListener('click', e => {
  if (!sizing) return;
  const card = cardOf(sizing);
  if (card && !card.contains(e.target)) closeSizing(false);
});

document.addEventListener('drawer:close', () => { lastDrawerClose = performance.now(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (isDrawerOpen() || performance.now() - lastDrawerClose < 80) return;   // the drawer took it
    if (panelOpen && qs('[data-presale-form]:not([hidden])', grid)) { e.preventDefault(); setPresaleOpen(false); return; }
    if (sizing) { closeSizing(true); return; }
    if (panelOpen) closePanel();
    return;
  }
  if (e.key === 'Tab' && panelOpen && !isDrawerOpen()) trapTab(e, sheet);
});

onCollectionChange(id => {
  paintWorld(collectionData(id));
  renderGrid();
});
onWishlistChange(syncHearts);

// ── boot ─────────────────────────────────────────────────────────────────────

paintWorld(collectionData());
renderGrid();
function restorePanelView() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem('lisa.collection-view.' + getCollection())); } catch (e) {}
  const allowed = qsa('[data-cat]', filterBar).map(node => node.dataset.cat).filter(cat => cat !== FILTER_ALL);
  cats = Array.isArray(saved?.cats) ? saved.cats.filter(cat => allowed.includes(cat)) : [];
  renderGrid();
  sheetScroll.scrollTop = Number.isFinite(saved?.top) ? saved.top : 0;
}

// Product return links open this showroom, never the old hero.
function openRequestedCollection() {
  const params = new URLSearchParams(location.search);
  if (params.get('view') !== 'collection') return;
  // The URL owns a product return/deep link. The runway's first paint can still
  // wear Rockstar while it positions the requested chapter.
  const requested = params.get('collection');
  const key = COLLECTIONS.some(col => col.id === requested) ? requested : getCollection();
  openPanel(document.querySelector('[data-open-collection="' + key + '"]'), { historyMode:'none' });
  restorePanelView();
}
if (window.runwaySnapshot && !document.documentElement.classList.contains('is-entering')) openRequestedCollection();
else document.addEventListener('runway:ready', openRequestedCollection, { once:true });

// The bag drawer on the runway shows the fan's Ztor bag: read it without holding up the runway's first paint.
state.hydrate(['member', 'cart']).then(() => document.dispatchEvent(new CustomEvent('cart:change', { detail: { type: 'sync' } })));
