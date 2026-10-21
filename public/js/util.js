// js/util.js — small shared helpers. No DOM assumptions beyond `document`.

// Touch focus restoration must not paint a keyboard ring; Tab restores it.
if (typeof matchMedia === 'function') {
  const touchLayout = matchMedia('(max-width:700px) and (pointer:coarse)');
  document.addEventListener('keydown', event => {
    if (touchLayout.matches && event.key === 'Tab') document.documentElement.dataset.keyboardFocus = 'true';
  });
  document.addEventListener('pointerdown', () => {
    if (touchLayout.matches) delete document.documentElement.dataset.keyboardFocus;
  }, { passive: true });
}

// money format (cart.js:35,42): the space after the symbol is part of the format → "HK$ 2,880"
export function money(n, currency = 'HK$') {
  return currency + ' ' + Number(n || 0).toLocaleString('en-US');
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ESC[c]);
}

export function slugify(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// build one element from an HTML string
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

// localStorage, defensively (private mode / blocked storage never throws out)
export function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
export function storageFailure(message) {
  let notice = document.querySelector('[data-storage-error]');
  if (!notice) {
    notice = document.createElement('div'); notice.dataset.storageError = ''; notice.setAttribute('role', 'alert');
    notice.style.cssText = 'position:fixed;z-index:10000;bottom:24px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:16px 20px;background:#191919;color:#fff;font:300 14px/1.5 var(--l-font);box-shadow:0 8px 28px #0003';
    document.body.append(notice);
  }
  notice.textContent = message;
  clearTimeout(notice._timer); notice._timer = setTimeout(() => notice.remove(), 8000);
}
export function readString(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
export function writeString(key, value) {
  try {
    if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, String(value));
    return true;
  } catch (e) { return false; }
}

// focus management for dialogs (ds-drawer.js:107-110 — visible focusables only)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function focusables(root) {
  return qsa(FOCUSABLE, root).filter(node => node.offsetParent !== null && node.getBoundingClientRect().width > 0);
}
// call from a keydown handler: keeps Tab / Shift+Tab inside `root`
export function trapTab(event, root) {
  if (event.key !== 'Tab') return;
  const list = focusables(root);
  if (!list.length) { event.preventDefault(); return; }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first.focus(); }
}

// force a reflow so a re-added class re-runs its transition/animation
export function reflow(node) {
  void node.offsetWidth;
}

// re-trigger a keyframe class (remove → reflow → add)
export function bump(node, cls) {
  node.classList.remove(cls);
  reflow(node);
  node.classList.add(cls);
}

export function pageName() {
  // serve.py serves clean URLs: '/' → index.html, '/loyalty' → loyalty.html, '/product?id=…' → product.html
  const last = location.pathname.split('/').pop();
  if (!last) return 'index.html';
  return last.includes('.') ? last : last + '.html';
}

export const ICONS = {
  bag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>',
  bagSmall: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>',
  checkSmall: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.4 8.4l3.1 3.1 6.1-6.9"></path></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"></path></svg>',
  heart: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8 13.6C8 13.6 2.6 10.2 2.6 6.9A2.9 2.9 0 0 1 8 5.3A2.9 2.9 0 0 1 13.4 6.9C13.4 10.2 8 13.6 8 13.6Z"></path></svg>',
  heartSmall: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13.4C8 13.4 2.4 10.1 2.4 6.5A2.8 2.8 0 0 1 8 5.1a2.8 2.8 0 0 1 5.6 1.4c0 3.6-5.6 6.9-5.6 6.9z"></path></svg>',
  minus: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10"></path></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.75 4.25h10.5"></path><path d="M6.25 4.25v-1a.9.9 0 0 1 .9-.9h1.7a.9.9 0 0 1 .9.9v1"></path><path d="M4.4 4.25l.62 8.3a1 1 0 0 0 1 .93h3.96a1 1 0 0 0 1-.93l.62-8.3"></path></svg>',
  chevronDown: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6"></path></svg>',
  chevronLeft: '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"></path></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg>',
  member: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.25"></circle><path d="M5.5 8.5l1.8 1.8L10.8 6.5"></path></svg>',
  bagEmpty: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>',
  tick: '<svg class="ds-success-tick__svg" viewBox="0 0 36 36" fill="none" stroke="currentColor" aria-hidden="true"><path class="ds-success-tick__check" fill="none" pathLength="1" d="M10 18.5 l5 5 l11 -12"></path></svg>'
};
