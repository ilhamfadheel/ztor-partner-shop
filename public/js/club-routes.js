// The club's pages are one app: moving between these is rendered in place (club.js), the way a
// Next.js app navigates, instead of loading a new document. Everything else (runway, product,
// checkout, the React pages, other sites) is a normal page load.
const VIEWS = { '/fan-club': 'home', '/loyalty': 'home', '/rewards': 'rewards', '/leaderboard': 'leaderboard', '/shop': 'shop', '/account': 'account', '/edit-profile': 'profile', '/signup': 'signup', '/auction': 'auction' };

export const TITLES = { home: 'Your Fan Club | LLOUD', rewards: 'Your rewards | LLOUD', leaderboard: 'Fan leaderboard | LLOUD', shop: 'The shop | LLOUD', account: 'Your account | LLOUD', profile: 'Edit profile | LLOUD', signup: 'Join LLOUD | LLOUD', auction: 'Auction | LLOUD' };

/** The club view a URL shows, or null when it is not a club page of this site. */
export function viewOf(href) {
  let url;
  try { url = new URL(href, location.href); } catch { return null; }
  if (url.origin !== location.origin) return null;
  return VIEWS[url.pathname.replace(/\.html$/, '')] ?? null;
}
