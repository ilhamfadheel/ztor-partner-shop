// js/checkout.js — LLOUD's checkout page (Bag.dc.html step=checkout) on the fan's Ztor cart.
//   The bag's buyable lines are quoted by the shop → pickup contact (a saved one, or a new name + phone)
//   → payment method (the remembered one first) → POST /checkout with a stable idempotency key → the
//   group id goes to sessionStorage for /checkout/done → off to the payment page when one is required,
//   else straight to /checkout/done (which polls the result).
//   Signed out → the Ztor sign-in, back here. Empty bag → the bag's empty state.
//   Layout and classes are LLOUD's: [data-co-main] hub groups, the summary aside, [data-co-empty].

import * as state from './ztor/state.js';
import { api, ApiError } from './ztor/api.js';
import { money } from './ztor/map.js';
import { signInHref } from './ztor/session.js';
import {
  payableLineIds, contactErrors, checkoutBody, afterCheckout, preferredMethod, savedPayment, savePayment, PENDING_GROUP, NEW_CONTACT
} from './ztor/commerce.js';
import { cart, onCartChange } from './cart.js';
import { openDrawer, closeDrawer } from './drawer.js';
import { escapeHtml, qs, qsa, prefersReducedMotion, ICONS } from './util.js';
import { t } from './i18n.js';

// Read at use time, so the page's language applies.
export const STRINGS = {
  get title() { return t('Checkout'); },
  get backBag() { return t('Back to bag'); },
  get contact() { return t('Pickup contact'); },
  get newContact() { return t('New contact'); },
  get whoCollects() { return t('Who collects the order'); },
  get name() { return t('Name'); },
  get phone() { return t('Phone'); },
  get payment() { return t('Payment'); },
  get noMethods() { return t('No payment method is available for this order right now.'); },
  get summary() { return t('Order summary'); },
  get subtotal() { return t('Subtotal'); },
  get discount() { return t('Discount'); },
  get total() { return t('Total'); },
  get calculating() { return t('Calculating…'); },
  get place() { return t('Pay now'); },
  get processing() { return t('Taking you to payment…'); },
  get payNote() { return t('You finish paying on the payment page; your order is confirmed once it has gone through.'); },
  get cantPlace() { return t('This order can’t be placed as it is. Review your bag and try again.'); },
  get quoteFailed() { return t('Your order could not be priced.'); },
  get loadFailed() { return t('Checkout could not load.'); },
  get leftOut() { return t('Unavailable items stay in your bag and aren’t included.'); },
  get retry() { return t('Try again'); },
  get reviewBag() { return t('Review your bag'); },
  get emptyTitle() { return t('Your bag is empty'); },
  get emptyDesc() { return t('Add the pieces you want and they will wait for you here.'); },
  get nothingTitle() { return t('Nothing to pay for'); },
  get nothingDesc() { return t('None of the items in your bag can be bought right now.'); },
  get emptyCta() { return t('Explore the shop'); }
};

const co = {
  contacts: [], methods: [], contactId: NEW_CONTACT, contact: { name: '', phone: '' }, touched: false,
  method: '', quote: null, quoteFor: '', quoteError: '', loadError: '', submitError: '', busy: false, loading: true
};

let root, head, backBtn, backLabel, title, grid, main, aside, confirmEl, emptyEl;
let mounted = false;
let quoting = 0;
let attempt = { body: '', key: '' };

const lines = () => cart.getItems();
const payable = () => lines().filter(l => l.status === 'AVAILABLE');

// ── loading ────────────────────────────────────────────────────────────────
function lost(error) {
  if (error instanceof ApiError && error.status === 401) { location.assign(signInHref('/checkout')); return true; }
  return false;
}

async function loadOptions() {
  co.loading = true;
  co.loadError = '';
  try {
    const [contacts, methods] = await Promise.all([api.pickupContacts(), api.paymentMethods()]);
    co.contacts = contacts;
    co.methods = methods;
    if (co.contactId === NEW_CONTACT && contacts[0]) co.contactId = contacts[0].contactId;
    co.method = preferredMethod(methods, savedPayment());
  } catch (error) {
    if (lost(error)) return;
    co.loadError = (error && error.message) || STRINGS.loadFailed;
  } finally {
    co.loading = false;
  }
}

/** Quotes the bag's buyable lines; a newer quote wins over one still on its way. */
async function requote() {
  const ids = payableLineIds(lines());
  const key = JSON.stringify(lines().map(l => [l.id, l.qty, l.status]));
  if (!ids.length) { co.quote = null; co.quoteFor = key; return; }
  if (key === co.quoteFor && co.quote) return;
  const ticket = ++quoting;
  co.quote = null;
  co.quoteError = '';
  renderAside();
  try {
    const quote = await api.quote(ids);
    if (ticket !== quoting) return;
    co.quote = quote;
    co.quoteFor = key;
  } catch (error) {
    if (ticket !== quoting || lost(error)) return;
    co.quoteError = (error && error.message) || STRINGS.quoteFailed;
  }
  renderAside();
}

// ── templates ──────────────────────────────────────────────────────────────
function radioHtml({ on, data, label, meta }) {
  return '<button class="checkout-method' + (on ? ' is-selected' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" ' + data + '>' +
    '<span class="checkout-method__radio" aria-hidden="true"></span>' +
    '<span class="checkout-method__main">' +
      '<span class="checkout-method__label">' + escapeHtml(label) + '</span>' +
      (meta ? '<span class="checkout-method__eta">' + escapeHtml(meta) + '</span>' : '') +
    '</span>' +
  '</button>';
}

function field(label, name, type, extra, error) {
  return '<label class="cc-field">' +
    '<span class="cc-field__label">' + label + '</span>' +
    '<input class="cc-field__input" type="' + type + '" name="' + name + '" value="' + escapeHtml(co.contact[name] || '') + '" ' + (extra || '') +
      (error ? ' aria-invalid="true" aria-describedby="co-' + name + '-err"' : '') + ' required data-req>' +
    (error ? '<span class="cc-pay__err" id="co-' + name + '-err" role="alert">' + escapeHtml(error) + '</span>' : '') +
  '</label>';
}

function contactGroupHtml() {
  const isNew = co.contactId === NEW_CONTACT;
  const errors = co.touched && isNew ? contactErrors(co.contact) : {};
  return '<div class="checkout-hub__group" data-co-contact>' +
    '<p class="checkout-hub__label" id="co-contact-label">' + STRINGS.contact + '</p>' +
    '<div class="checkout-methods" role="radiogroup" aria-labelledby="co-contact-label">' +
      co.contacts.map(c => radioHtml({ on: co.contactId === c.contactId, data: 'data-contact="' + escapeHtml(c.contactId) + '"', label: c.name, meta: c.phone })).join('') +
      radioHtml({ on: isNew, data: 'data-contact="' + NEW_CONTACT + '"', label: STRINGS.newContact, meta: STRINGS.whoCollects }) +
    '</div>' +
    (isNew
      ? '<form class="checkout-form" novalidate data-co-contact-form>' +
          '<div class="checkout-form__row">' +
            field(STRINGS.name, 'name', 'text', 'autocomplete="name" maxlength="60"', errors.name) +
            field(STRINGS.phone, 'phone', 'tel', 'inputmode="tel" autocomplete="tel" maxlength="30"', errors.phone) +
          '</div>' +
        '</form>'
      : '') +
  '</div>';
}

function paymentGroupHtml() {
  return '<div class="checkout-hub__group" data-co-payment>' +
    '<p class="checkout-hub__label" id="co-pay-label">' + STRINGS.payment + '</p>' +
    (co.methods.length
      ? '<div class="checkout-methods" role="radiogroup" aria-labelledby="co-pay-label">' +
          co.methods.map(m => radioHtml({ on: co.method === m.methodCode, data: 'data-method="' + escapeHtml(m.methodCode) + '"', label: m.displayName || m.methodCode })).join('') +
        '</div>'
      : '<p class="checkout-foot__hint">' + STRINGS.noMethods + '</p>') +
  '</div>';
}

function hubHtml() {
  if (co.loading) return '<div class="checkout-hub checkout-view" data-co-view="hub" aria-busy="true"><p class="checkout-foot__hint">' + STRINGS.calculating + '</p></div>';
  if (co.loadError) {
    return '<div class="checkout-hub checkout-view" data-co-view="hub">' +
      '<p class="cc-callout cc-callout--error" role="alert">' + escapeHtml(STRINGS.loadFailed + ' ' + co.loadError) + '</p>' +
      '<button class="btn btn--ghost btn--md" type="button" data-co-reload>' + STRINGS.retry + '</button>' +
    '</div>';
  }
  return '<div class="checkout-hub checkout-view" data-co-view="hub">' +
    contactGroupHtml() + paymentGroupHtml() +
    '<p class="checkout-foot__hint">' + STRINGS.payNote + '</p>' +
  '</div>';
}

function summaryHtml() {
  const q = co.quote;
  const items = payable();
  const currency = q?.currency || items[0]?.currency || 'HKD';
  const pending = '<span aria-live="polite">' + STRINGS.calculating + '</span>';
  return '<p class="checkout-hub__label">' + STRINGS.summary + '</p>' +
    '<div class="checkout-sum" data-co-sum>' +
    '<div class="checkout-sum__lines">' +
      items.map(it =>
        '<div class="checkout-sum__line">' +
          '<span class="checkout-sum__line-title">' + escapeHtml(it.title + (it.size ? ' (' + it.size + ')' : '')) + ' ×' + it.qty + '</span>' +
          '<span>' + escapeHtml(money(it.price * it.qty, it.currency)) + '</span>' +
        '</div>').join('') +
    '</div>' +
    '<div class="cc-pay__summary">' +
      '<div class="cc-pay__sumrow"><span>' + STRINGS.subtotal + '</span><span data-co-sub>' + (q ? escapeHtml(money(q.subtotal, currency)) : pending) + '</span></div>' +
      '<div class="cc-pay__sumrow checkout-sum__discount" data-co-discount' + (q?.discountAmount > 0 ? '' : ' hidden') + '>' +
        '<span>' + STRINGS.discount + '</span><span>−' + escapeHtml(money(q?.discountAmount || 0, currency)) + '</span></div>' +
      '<div class="cc-pay__sumrow cc-pay__sumrow--total"><span>' + STRINGS.total + '</span><span data-co-total>' + (q ? escapeHtml(money(q.payableAmount ?? q.subtotal, currency)) : pending) + '</span></div>' +
    '</div>' +
  '</div>';
}

function canPay() {
  const q = co.quote;
  return !co.busy && !co.loading && !co.loadError && !!q?.confirmationHash && q.canCreate && !!co.method;
}

function footHtml() {
  const q = co.quote;
  const leftOut = lines().length > payable().length;
  const total = q ? ' · ' + money(q.payableAmount ?? q.subtotal, q.currency) : '';
  return '<div class="checkout-page__foot" data-co-foot>' +
    (leftOut ? '<p class="checkout-foot__hint">' + STRINGS.leftOut + '</p>' : '') +
    (co.quoteError
      ? '<p class="cc-callout cc-callout--error" role="alert">' + escapeHtml(STRINGS.quoteFailed + ' ' + co.quoteError) +
          ' <button class="checkout-hub__edit" type="button" data-co-requote>' + STRINGS.retry + '</button></p>'
      : '') +
    (q && !q.canCreate
      ? '<p class="cc-callout cc-callout--error" role="alert" data-co-cant>' + STRINGS.cantPlace +
          ' <button class="checkout-hub__edit" type="button" data-co-return-bag>' + STRINGS.reviewBag + '</button></p>'
      : '') +
    (co.submitError ? '<p class="cc-callout cc-callout--error" role="alert" data-co-error>' + escapeHtml(t('Checkout didn’t start: {reason}', { reason: co.submitError })) + '</p>' : '') +
    '<button class="btn btn--primary btn--lg checkout-cta" type="button" data-place' + (canPay() ? '' : ' disabled') + (co.busy ? ' aria-busy="true"' : '') + '>' +
      (co.busy ? STRINGS.processing : STRINGS.place + escapeHtml(total)) +
    '</button>' +
  '</div>';
}

// the bag's own empty state (drawer.js emptyHtml) — same component
function emptyHtml(nothing) {
  return '<div class="ztor-cart__empty">' +
    '<span class="ztor-cart__empty-icon" aria-hidden="true">' + ICONS.bagEmpty + '</span>' +
    '<h2 class="ztor-cart__empty-title">' + (nothing ? STRINGS.nothingTitle : STRINGS.emptyTitle) + '</h2>' +
    '<p class="ztor-cart__empty-desc">' + (nothing ? STRINGS.nothingDesc : STRINGS.emptyDesc) + '</p>' +
    (nothing
      ? '<button class="ztor-cart__empty-cta" type="button" data-co-return-bag>' + STRINGS.reviewBag + '</button>'
      : '<a class="ztor-cart__empty-cta" href="/shop" data-co-empty-cta>' + STRINGS.emptyCta + '</a>') +
  '</div>';
}

// ── render ─────────────────────────────────────────────────────────────────
function renderAside() {
  if (!mounted || grid.hidden) return;
  aside.innerHTML = summaryHtml() + footHtml();
}

function showGrid(on) {
  grid.hidden = !on;
  head.hidden = !on;
}

export function render() {
  if (!mounted) return;
  confirmEl.hidden = true;
  const all = lines();
  if (!all.length || !payable().length) {
    root.dataset.view = 'empty';
    showGrid(false);
    title.textContent = STRINGS.title;
    emptyEl.innerHTML = emptyHtml(all.length > 0);
    emptyEl.hidden = false;
    return;
  }
  root.dataset.view = 'hub';
  emptyEl.hidden = true;
  showGrid(true);
  title.textContent = STRINGS.title;
  backLabel.textContent = STRINGS.backBag;
  backBtn.hidden = false;
  const keep = focusDescriptor();
  main.innerHTML = hubHtml();
  renderAside();
  restoreFocus(keep);
}

function focusDescriptor() {
  const a = document.activeElement;
  if (!a || !main.contains(a)) return null;
  if (a.name) return '[name="' + a.name + '"]';
  if (a.dataset.contact) return '[data-contact="' + CSS.escape(a.dataset.contact) + '"]';
  if (a.dataset.method) return '[data-method="' + CSS.escape(a.dataset.method) + '"]';
  return null;
}
function restoreFocus(selector) {
  const node = selector && qs(selector, main);
  if (node) node.focus({ preventScroll: true });
}

// ── handlers ───────────────────────────────────────────────────────────────
function pickContact(id) {
  if (co.contactId === id) return;
  co.contactId = id;
  co.touched = false;
  render();
  if (id === NEW_CONTACT) qs('[name="name"]', main)?.focus({ preventScroll: true });
}

function pickMethod(code) {
  if (co.method === code) return;
  co.method = code;
  savePayment(code);
  qsa('[data-method]', main).forEach(b => {
    const on = b.dataset.method === code;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  renderAside();
}

async function placeOrder() {
  if (!canPay()) return;
  if (co.contactId === NEW_CONTACT) {
    const errors = contactErrors(co.contact);
    if (Object.keys(errors).length) {
      co.touched = true;
      render();
      qs('[name="' + (errors.name ? 'name' : 'phone') + '"]', main)?.focus({ preventScroll: true });
      return;
    }
  }
  const body = checkoutBody({ lineIds: payableLineIds(lines()), method: co.method, quote: co.quote, contactId: co.contactId, contact: co.contact, origin: location.origin });
  // the same order retried keeps its key (the shop answers once); a changed order is a new one
  const signature = JSON.stringify(body);
  if (attempt.body !== signature) attempt = { body: signature, key: crypto.randomUUID() };
  co.busy = true;
  co.submitError = '';
  renderAside();
  try {
    const result = await api.checkout(body, attempt.key);
    try { sessionStorage.setItem(PENDING_GROUP, result.group.checkoutGroupId); } catch { /* the result page asks for it again */ }
    location.assign(afterCheckout(result));
  } catch (error) {
    co.busy = false;
    if (lost(error)) return;
    co.submitError = (error && error.message) || t('Try again.');
    renderAside();
    qs('[data-co-error]', aside)?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

function onClick(e) {
  const t = e.target;
  if (t.closest('[data-co-return-bag]')) { openDrawer(t.closest('[data-co-return-bag]')); return; }
  const contact = t.closest('[data-contact]');
  if (contact && main.contains(contact)) { pickContact(contact.dataset.contact); return; }
  const method = t.closest('[data-method]');
  if (method && main.contains(method)) { pickMethod(method.dataset.method); return; }
  if (t.closest('[data-co-reload]')) { loadOptions().then(render); render(); return; }
  if (t.closest('[data-co-requote]')) { co.quoteFor = ''; requote(); return; }
  if (t.closest('[data-place]')) { placeOrder(); }
}

function onInput(e) {
  const t = e.target;
  if (!t.matches('[data-co-contact-form] [data-req]')) return;
  co.contact[t.name] = t.value;
  if (t.value.trim() && t.getAttribute('aria-invalid')) {
    t.removeAttribute('aria-invalid');
    t.parentElement.querySelector('.cc-pay__err')?.remove();
  }
}

function onSubmit(e) {
  if (!e.target.closest('[data-co-contact-form]')) return;
  e.preventDefault();
  placeOrder();
}

// ── mount ──────────────────────────────────────────────────────────────────
export async function mountCheckout(node) {
  root = node || qs('[data-checkout]');
  if (!root || mounted) return root;
  if (!state.session()) { location.replace(signInHref('/checkout')); return root; }
  head = qs('[data-co-head]', root);
  backBtn = qs('[data-co-back]', root);
  backLabel = qs('[data-co-back-label]', root);
  title = qs('[data-co-title]', root);
  grid = qs('[data-co-grid]', root);
  main = qs('[data-co-main]', root);
  aside = qs('[data-co-aside]', root);
  confirmEl = qs('[data-co-confirm]', root);
  emptyEl = qs('[data-co-empty]', root);
  mounted = true;
  document.title = STRINGS.title + ' | LLOUD';

  backBtn.addEventListener('click', () => openDrawer(backBtn));
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('submit', onSubmit);

  // the bag can change under us from the drawer (mounted on every page): re-price, keep what is typed
  onCartChange(() => { if (!co.busy) { render(); requote(); } });

  // on this page the drawer's Checkout CTA is a return, not a navigation
  document.addEventListener('click', e => {
    const cta = e.target.closest('[data-cart-checkout]');
    if (!cta) return;
    e.preventDefault();
    closeDrawer();
    (backBtn.hidden ? title : backBtn).focus({ preventScroll: true });
  }, true);

  render();
  if (!payable().length) return root;
  await Promise.all([loadOptions(), requote()]);
  render();
  return root;
}

await mountCheckout();

export default { mountCheckout, render, state: co };
