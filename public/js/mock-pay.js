// js/mock-pay.js — port of Ztor assets/mock-pay.js (ZtorPay). NEVER a real charge; stores nothing.
// Renders into a caller-supplied node (the .cc-pay family from css/kit.css Section 8) and owns nothing else.
//   mockPay.open({ mount, amount, currency, title, mode, confirmLabel, backLabel, forceForm, onSuccess, onFail, onBack })
//   result → onSuccess({ last4, outcome: 'ok'|'sca', mode, ts, saved? })
//   validation (first failure wins): all filled → card ≥ 12 digits → MM/YY → CVC ≥ 3 digits. No Luhn, no expiry check.
//   test cards by LAST FOUR: 0002 → declined · 3220 / 3155 → 3-D Secure interstitial · anything else → ok
//   saved-card fast path when document.body.dataset.hasCard === 'true' (and !forceForm): one tap, last4 4242
//   demoOnly: hide unsupported wallet/card-saving controls and use explicit simulation copy.

import { money, escapeHtml } from './util.js';

export const SAVED_LAST4 = '4242';

export const STRINGS = {
  methodLabel: 'Payment method',
  amountDue: 'Amount due',
  verifyAmount: 'Verification amount (not charged unless you win)',
  savedBrand: 'Card',
  useAnother: 'Use another card',
  savedSecure: 'Using your saved payment method (demo)',
  applePay: 'Apple Pay',
  googlePay: 'Google Pay',
  or: 'Or pay by credit / debit card',
  nameOnCard: 'Name on card',
  cardNumber: 'Card number',
  expiry: 'Expiry (MM/YY)',
  cvc: 'Security code',
  saveCard: 'Save this card for next time',
  secure: 'Secure payment · card details are encrypted (demo)',
  confirmCharge: 'Save and use this card',
  confirmVerify: 'Verify card',
  back: 'Back',
  scaCallout: 'Your bank asks for one more step. Complete verification to confirm this payment (demo).',
  scaBank: 'Lisa Bank · 3-D Secure',
  scaRow: 'A one-time code has been sent to •••• 8888',
  scaOk: 'Complete verification',
  scaCancel: 'Cancel',
  errFields: 'Please complete every field.',
  errCard: 'Please enter a valid card number.',
  errExp: 'Expiry must read MM/YY.',
  errCvc: 'That security code is not right.',
  errDeclined: 'Card declined. Try another card (test: card ending 0002).'
};

const digits = s => String(s ?? '').replace(/[^0-9]/g, '');
export const last4 = card => digits(card).slice(-4);

export function validate(form) {
  const required = [form.name, form.card, form.exp, form.cvc];
  if (required.some(v => !String(v ?? '').trim())) return STRINGS.errFields;
  if (digits(form.card).length < 12) return STRINGS.errCard;
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(String(form.exp).trim())) return STRINGS.errExp;
  if (digits(form.cvc).length < 3) return STRINGS.errCvc;
  return '';
}

export function outcome(card) {
  const l4 = last4(card);
  if (l4 === '0002') return 'declined';
  if (l4 === '3220' || l4 === '3155') return 'sca';
  return 'ok';
}

function hasSavedCard() {
  return document.body && document.body.dataset.hasCard === 'true';
}

function summaryHtml(o) {
  const totalLabel = o.mode === 'verify' ? STRINGS.verifyAmount : STRINGS.amountDue;
  return '<div class="cc-pay__summary">' +
    '<div class="cc-pay__sumrow"><span>' + escapeHtml(o.title || STRINGS.methodLabel) + '</span><span></span></div>' +
    '<div class="cc-pay__sumrow cc-pay__sumrow--total"><span>' + totalLabel + '</span><span data-cc-pay-amount>' + escapeHtml(money(o.amount || 0, o.currency)) + '</span></div>' +
  '</div>';
}

function footHtml(o, confirmLabel) {
  return '<div class="cc-stepview__foot">' +
    '<button class="btn btn--primary btn--lg" type="submit" data-cc-pay-submit>' + escapeHtml(confirmLabel) + '</button>' +
    (o.backLabel === false ? '' : '<button class="btn btn--ghost btn--md" type="button" data-cc-pay-back>' + escapeHtml(o.backLabel || STRINGS.back) + '</button>') +
  '</div>';
}

function formHtml(o) {
  const confirmLabel = o.confirmLabel || (o.mode === 'verify' ? STRINGS.confirmVerify : STRINGS.confirmCharge);
  return '<form class="cc-pay" novalidate data-cc-pay-form>' +
    summaryHtml(o) +
    (o.demoOnly ? '' : '<div class="cc-pay__express">' +
      '<button type="button" class="cc-pay__express-btn" disabled>' + STRINGS.applePay + '</button>' +
      '<button type="button" class="cc-pay__express-btn" disabled>' + STRINGS.googlePay + '</button>' +
    '</div>' +
    '<div class="cc-pay__or"><span>' + STRINGS.or + '</span></div>') +
    '<div class="cc-pay__form">' +
      '<label class="cc-field"><span class="cc-field__label">' + STRINGS.nameOnCard + '</span>' +
        '<input class="cc-field__input" type="text" name="name" placeholder="[NAME ON CARD]" autocomplete="off" data-req></label>' +
      '<label class="cc-field"><span class="cc-field__label">' + STRINGS.cardNumber + '</span>' +
        '<input class="cc-field__input" type="text" name="card" inputmode="numeric" placeholder="[CARD NUMBER]" autocomplete="off" data-req></label>' +
      '<div class="cc-pay__grid2">' +
        '<label class="cc-field"><span class="cc-field__label">' + STRINGS.expiry + '</span>' +
          '<input class="cc-field__input" type="text" name="exp" inputmode="numeric" placeholder="[MM/YY]" autocomplete="off" data-req></label>' +
        '<label class="cc-field"><span class="cc-field__label">' + STRINGS.cvc + '</span>' +
          '<input class="cc-field__input" type="text" name="cvc" inputmode="numeric" placeholder="[CVC]" autocomplete="off" data-req></label>' +
      '</div>' +
      (o.demoOnly ? '' : '<label class="cc-pay__save"><input type="checkbox" name="save-card" checked> ' + STRINGS.saveCard + '</label>') +
      '<p class="cc-pay__err" data-cc-pay-err hidden role="alert"></p>' +
      '<div class="cc-pay__secure"><span class="cc-pay__lock" aria-hidden="true"></span>' + (o.demoOnly ? 'Simulation only · card details are not sent or saved' : STRINGS.secure) + '</div>' +
      footHtml(o, confirmLabel) +
    '</div>' +
  '</form>';
}

function savedHtml(o) {
  const confirmLabel = o.confirmLabel || (o.mode === 'verify' ? STRINGS.confirmVerify : STRINGS.confirmCharge);
  return '<div class="cc-pay" data-cc-pay-saved>' +
    summaryHtml(o) +
    '<div class="cc-pay__saved">' +
      '<div class="cc-pay__saved-card"><span class="cc-pay__saved-brand">' + STRINGS.savedBrand + '</span>' +
      '<span class="cc-pay__saved-num">•••• •••• •••• ' + SAVED_LAST4 + '</span></div>' +
      '<button type="button" class="cc-pay__saved-new" data-cc-pay-new>' + STRINGS.useAnother + '</button>' +
    '</div>' +
    '<div class="cc-pay__secure"><span class="cc-pay__lock" aria-hidden="true"></span>' + STRINGS.savedSecure + '</div>' +
    '<div class="cc-stepview__foot">' +
      '<button class="btn btn--primary btn--lg" type="button" data-cc-pay-saved-ok>' + escapeHtml(confirmLabel) + '</button>' +
      (o.backLabel === false ? '' : '<button class="btn btn--ghost btn--md" type="button" data-cc-pay-back>' + escapeHtml(o.backLabel || STRINGS.back) + '</button>') +
    '</div>' +
  '</div>';
}

function scaHtml(o) {
  return '<div class="cc-pay" data-cc-pay-sca>' +
    '<div class="cc-callout cc-callout--info"><span class="cc-callout__icon" aria-hidden="true"></span>' + (o.demoOnly ? 'Preview the extra verification step a bank may request. No bank is connected.' : STRINGS.scaCallout) + '</div>' +
    '<div class="cc-sca"><div class="cc-sca__bank">' + STRINGS.scaBank + '</div><div class="cc-sca__row">' + (o.demoOnly ? 'Demo verification · no message was sent' : STRINGS.scaRow) + '</div></div>' +
    '<div class="cc-stepview__foot">' +
      '<button class="btn btn--primary btn--lg" type="button" data-cc-sca-ok>' + STRINGS.scaOk + '</button>' +
      '<button class="btn btn--ghost btn--md" type="button" data-cc-sca-cancel>' + STRINGS.scaCancel + '</button>' +
    '</div>' +
  '</div>';
}

function readForm(form) {
  const v = name => { const f = form.querySelector('[name="' + name + '"]'); return f ? f.value : ''; };
  const save = form.querySelector('[name="save-card"]');
  return { name: v('name'), card: v('card'), exp: v('exp'), cvc: v('cvc'), save: !!(save && save.checked) };
}

function renderForm(node, o) {
  node.innerHTML = formHtml(o);
  const form = node.querySelector('[data-cc-pay-form]');
  const err = node.querySelector('[data-cc-pay-err]');
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = readForm(form);
    const msg = validate(f);
    if (msg) { fail(msg); return; }
    const result = outcome(f.card);
    if (result === 'declined') {
      fail(STRINGS.errDeclined);
      if (typeof o.onFail === 'function') o.onFail('declined');
      return;
    }
    if (result === 'sca') { renderSca(node, o, f); return; }
    if (typeof o.onSuccess === 'function') o.onSuccess({ last4: last4(f.card), outcome: 'ok', mode: o.mode || 'charge', ts: Date.now() });
  });
  const back = node.querySelector('[data-cc-pay-back]');
  if (back) back.addEventListener('click', () => { if (typeof o.onBack === 'function') o.onBack(); });
  const first = node.querySelector('[name="name"]');
  if (first) first.focus({ preventScroll: true });
}

function renderSca(node, o, f) {
  node.innerHTML = scaHtml(o);
  node.querySelector('[data-cc-sca-ok]').addEventListener('click', () => {
    if (typeof o.onSuccess === 'function') o.onSuccess({ last4: last4(f.card), outcome: 'sca', mode: o.mode || 'charge', ts: Date.now() });
  });
  node.querySelector('[data-cc-sca-cancel]').addEventListener('click', () => renderForm(node, o));
}

function renderSaved(node, o) {
  node.innerHTML = savedHtml(o);
  node.querySelector('[data-cc-pay-saved-ok]').addEventListener('click', () => {
    if (typeof o.onSuccess === 'function') o.onSuccess({ last4: SAVED_LAST4, outcome: 'ok', mode: o.mode || 'charge', ts: Date.now(), saved: true });
  });
  node.querySelector('[data-cc-pay-new]').addEventListener('click', () => renderForm(node, o));
  const back = node.querySelector('[data-cc-pay-back]');
  if (back) back.addEventListener('click', () => { if (typeof o.onBack === 'function') o.onBack(); });
}

export const mockPay = {
  open(o = {}) {
    if (!o.mount) { console.warn('[mock-pay] open(): mount is required'); return null; }
    const opts = { currency: 'HK$', mode: 'charge', ...o };
    opts.mount.__ccPay = opts;   // setAmount() reaches the live options
    if (hasSavedCard() && !opts.forceForm) renderSaved(opts.mount, opts); else renderForm(opts.mount, opts);
    return opts.mount;
  },
  // the amount due changed under an open sheet (the bag drawer edited a line): repaint the figure, keep the form
  setAmount(mount, amount, currency) {
    const opts = mount && mount.__ccPay;
    if (!opts) return false;
    opts.amount = amount;
    if (currency) opts.currency = currency;
    mount.querySelectorAll('[data-cc-pay-amount]').forEach(n => { n.textContent = money(amount || 0, opts.currency); });
    return true;
  },
  _validate: validate,
  _outcome: outcome,
  _last4: last4
};

export default mockPay;
