// The LLOUD pages' languages: the same three as the React pages (lib/i18n.ts) and the fan's Ztor
// account. The fan's choice is the ztor_lang cookie (set when their account loads or they change it
// on /account); without one, the browser's languages decide; else English.
//
// Strings are written in English in the code and wrapped in t('…'); the English text is the key.
// Each area of the site keeps its Chinese in js/locales/<area>.js ({ 'zh-hk': {…}, 'zh-cn': {…} }),
// and test/lloud/i18n.test.mjs checks every t('…') in the code has both. {name} in a string is
// filled from t()'s second argument.
import club from './locales/club.js';
import account from './locales/account.js';
import commerce from './locales/commerce.js';
import auction from './locales/auction.js';
import runway from './locales/runway.js';

export const LANGS = ['en-us', 'zh-hk', 'zh-cn'];
const COOKIE = 'ztor_lang';
const AREAS = [club, account, commerce, auction, runway];
/** Every Chinese string, merged across the areas. */
export const MESSAGES = Object.fromEntries(['zh-hk', 'zh-cn'].map(lang => [lang, Object.assign({}, ...AREAS.map(area => area[lang] ?? {}))]));

const asLang = value => (LANGS.includes(String(value ?? '').trim().toLowerCase()) ? String(value).trim().toLowerCase() : null);

/** The same rule as lib/i18n.ts langFromAcceptLanguage, over navigator.languages. */
export function langFromBrowser(tags = []) {
  for (const raw of tags) {
    const tag = String(raw).toLowerCase();
    if (tag.startsWith('en')) return 'en-us';
    if (tag.startsWith('zh')) return /hant|hk|mo|tw/.test(tag) ? 'zh-hk' : 'zh-cn';
  }
  return null;
}

export function readLangCookie() {
  const cookie = typeof document !== 'undefined' && typeof document.cookie === 'string' ? document.cookie : '';
  const pair = cookie.split('; ').find(c => c.startsWith(COOKIE + '='));
  return asLang(pair?.slice(COOKIE.length + 1));
}

export function storeLangCookie(lang) {
  if (asLang(lang)) document.cookie = `${COOKIE}=${asLang(lang)}; path=/; max-age=31536000; samesite=lax`;
}

let current = null;
/** The page's language, decided once per page load. */
export function lang() {
  current ??= readLangCookie() ?? langFromBrowser(typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []) ?? 'en-us';
  return current;
}
/** For tests: decide again. */
export const resetLang = () => { current = null; };

/** What goes on <html lang> (as lib/i18n.ts htmlLang). */
export const htmlLang = (l = lang()) => ({ 'en-us': 'en', 'zh-hk': 'zh-HK', 'zh-cn': 'zh-CN' })[l] ?? 'en';
/** Intl's locale for numbers and dates. */
export const locale = () => ({ 'zh-hk': 'zh-HK', 'zh-cn': 'zh-CN' })[lang()] ?? 'en-US';

/** The text in the page's language (English when no translation exists), with {name}s filled in. */
export function t(text, vars) {
  const l = lang();
  const out = l === 'en-us' ? text : MESSAGES[l]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/**
 * The fan's saved account language wins: when it differs from what this page shows, keep it and
 * show the page again in it (once — the cookie then matches).
 */
export function followAccountLanguage(accountLang) {
  const wanted = asLang(accountLang);
  if (!wanted || wanted === readLangCookie()) return false;
  storeLangCookie(wanted);
  if (wanted !== lang()) { location.reload(); return true; }
  return false;
}

/** Static text in the HTML: elements with data-i18n get their text, data-i18n-<attr> an attribute. */
export function translateDocument(root = document) {
  document.documentElement.lang = htmlLang();
  if (lang() === 'en-us') return;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.textContent.trim()); });
  for (const attr of ['aria-label', 'title', 'placeholder', 'alt', 'content']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => { if (el.hasAttribute(attr)) el.setAttribute(attr, t(el.getAttribute(attr))); });
  }
  if (document.title) document.title = t(document.title);
}
