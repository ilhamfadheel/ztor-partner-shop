// The club's pages are one app: moving between these is rendered in place (club.js), the way a
// Next.js app navigates, instead of loading a new document. Everything else (runway, product,
// checkout, the React pages, other sites) is a normal page load.
import { t } from './i18n.js';

const VIEWS = { '/fan-club': 'home', '/loyalty': 'home', '/rewards': 'rewards', '/leaderboard': 'leaderboard', '/shop': 'shop', '/account': 'account', '/edit-profile': 'profile', '/signup': 'signup', '/auction': 'auction' };

export const TITLES = { home: t('Your Fan Club | LLOUD'), rewards: t('Your rewards | LLOUD'), leaderboard: t('Fan leaderboard | LLOUD'), shop: t('The shop | LLOUD'), account: t('Your account | LLOUD'), profile: t('Edit profile | LLOUD'), signup: t('Join LLOUD | LLOUD'), auction: t('Auction | LLOUD') };

/** The club view a URL shows, or null when it is not a club page of this site. */
export function viewOf(href) {
  let url;
  try { url = new URL(href, location.href); } catch { return null; }
  if (url.origin !== location.origin) return null;
  return VIEWS[url.pathname.replace(/\.html$/, '')] ?? null;
}
