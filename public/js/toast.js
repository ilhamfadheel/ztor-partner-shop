// js/toast.js — the kit toast (.ds-toast with the animated .ds-success-tick; ds-toast.css + window.DSToast).
//   showToast(message, { link, onLink, duration })  — single instance, one shared timer,
//   forces a reflow before re-adding .is-shown so a rapid repeat re-runs the transition.
//   Default link action opens the bag drawer (PORT.md Section f). Default 2600ms.

import { el, reflow, prefersReducedMotion, ICONS } from './util.js';
import { openDrawer, isDrawerOpen } from './drawer.js';
import { t } from './i18n.js';

let node = null;
let timer = 0;
let linkHandler = null;
let lastFocus = null;   // the control focused before the toast link took focus (the drawer returns focus there)
let hideTimer = 0;      // the [hidden] toggle after the exit transition (Safari 26: an inactive fixed toast is display:none, not opacity:0)
const EXIT_MS = 220;    // kit.css .ds-toast opacity/transform transition
const MOBILE = window.matchMedia('(max-width: 767.98px)');

document.addEventListener('focusin', e => {
  if (!(node && node.contains(e.target))) lastFocus = e.target;
});

// on a phone the full-width drawer IS the confirmation, and the toast would sit on its Checkout CTA
document.addEventListener('drawer:open', () => { if (MOBILE.matches) hideToast(); });

function ensure() {
  if (node) return node;
  node = el(
    '<div class="ds-toast" role="status" aria-live="polite" hidden>' +
      '<span class="ds-toast__dot ds-success-tick" aria-hidden="true">' + ICONS.tick + '</span>' +
      '<span class="ds-toast__msg"></span>' +
      '<button class="ds-toast__link" type="button"></button>' +
    '</div>'
  );
  node.querySelector('.ds-toast__link').addEventListener('click', e => {
    const fn = linkHandler;
    hideToast();
    // never hand the (now hidden) toast link to the drawer as its opener: Escape would return focus into it
    const from = lastFocus && lastFocus.isConnected && lastFocus !== document.body ? lastFocus : e.currentTarget;
    if (typeof fn === 'function') fn(e); else openDrawer(from);
  });
  document.body.appendChild(node);
  return node;
}

export function showToast(message, { link = t('View bag'), onLink = null, duration = 2600 } = {}) {
  if (MOBILE.matches && isDrawerOpen()) { hideToast(); return null; }
  const toast = ensure();
  clearTimeout(timer);
  clearTimeout(hideTimer);
  toast.hidden = false;
  toast.querySelector('.ds-toast__msg').textContent = String(message ?? '');
  const btn = toast.querySelector('.ds-toast__link');
  if (link) { btn.hidden = false; btn.textContent = link; } else { btn.hidden = true; }
  linkHandler = onLink;
  // re-run the tick animation and the entry transition
  const dot = toast.querySelector('.ds-toast__dot');
  dot.classList.remove('ds-success-tick');
  toast.classList.remove('is-shown');
  reflow(toast);
  dot.classList.add('ds-success-tick');
  toast.classList.add('is-shown');
  if (duration > 0) timer = setTimeout(hideToast, duration);
  return toast;
}

export function hideToast() {
  clearTimeout(timer);
  timer = 0;
  if (!node) return;
  node.classList.remove('is-shown');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    // a keyboard user parked on the link must not lose focus to <body> when the toast leaves the tree
    if (node.contains(document.activeElement) && lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    node.hidden = true;
  }, prefersReducedMotion() ? 0 : EXIT_MS);
}

// the kit's list-page toast shape: 「NAME」已加入購物車 + 去結帳 → “NAME” added to bag + View bag
// (message goes through textContent, so the raw name is passed — no escaping)
export function toastAdded(name, opts = {}) {
  return showToast(t('“{name}” added to bag', { name: String(name ?? '') }), { link: t('View bag'), duration: 3400, ...opts });
}
