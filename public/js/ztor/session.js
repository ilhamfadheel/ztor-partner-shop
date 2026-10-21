// The fan's Ztor sign-in, for the LLOUD pages (static ES modules, no build). It shares the session
// the React pages keep (localStorage "ztor_session", written by /auth/callback) and renews it the
// same way lib/oidc.ts does — keep the two in step: Ztor rotates the refresh token on every use and
// treats a second use of an old one as theft, so one renewal at a time, across tabs (Web Locks).
import config from '/lloud-config.js';

const SESSION_KEY = 'ztor_session';
/** Renew this long before the access token runs out, so no request leaves with a dying token. */
const REFRESH_EARLY_MS = 60_000;

let discovery;
function discover() {
  discovery ??= fetch(`${config.issuer}/.well-known/openid-configuration`).then(r => {
    if (!r.ok) throw new Error(`Discovery failed (HTTP ${r.status})`);
    return r.json();
  });
  return discovery;
}

function claims(jwt) {
  const part = jwt.split('.')[1] ?? '';
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + ((4 - (part.length % 4)) % 4), '='));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, c => c.charCodeAt(0))));
}

function stored() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
}

function save(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('ztor-session'));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('ztor-session'));
}

/** The session while its access token is still good, else null. */
export function getSession() {
  const session = stored();
  return session && session.expiresAt > Date.now() ? session : null;
}

const lasts = session => !!session && session.expiresAt - REFRESH_EARLY_MS > Date.now();

/** A token response as the session; on a refresh, what the response leaves out stays as it was. */
function toSession(token, previous) {
  const idToken = token.id_token ?? previous?.idToken;
  if (!token.access_token || !idToken) throw new Error('Incomplete token response.');
  const id = claims(idToken);
  if (id.iss !== config.issuer || id.aud !== config.clientId || typeof id.exp !== 'number' || (token.id_token && id.exp * 1000 < Date.now())) throw new Error('ID token rejected.');
  return {
    accessToken: token.access_token,
    idToken,
    refreshToken: token.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    user: { sub: String(id.sub), name: typeof id.name === 'string' ? id.name : undefined, email: typeof id.email === 'string' ? id.email : undefined },
  };
}

let renewing;

/** The session, renewed with the refresh token when less than a minute is left; null when signed out. */
export function currentSession() {
  if (lasts(stored())) return Promise.resolve(stored());
  renewing ??= (navigator.locks ? navigator.locks.request('ztor-session-refresh', renew) : renew()).finally(() => (renewing = undefined));
  return renewing;
}

async function renew() {
  const session = stored();
  if (lasts(session)) return session; // another tab renewed it while this one waited for the lock
  if (!session?.refreshToken) return getSession();
  let response;
  try {
    response = await fetch((await discover()).token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: session.refreshToken,
        ...(config.shopResource ? { resource: config.shopResource } : {}),
      }),
    });
  } catch {
    return getSession(); // offline: the refresh token stays for the next try
  }
  const token = await response.json().catch(() => ({}));
  if (response.ok && token.access_token) {
    try {
      const next = toSession(token, session);
      save(next);
      return next;
    } catch {
      // An answer that doesn't hold together ends the sign-in, like a refusal.
    }
  } else if (response.status >= 500 || response.status === 429) {
    return getSession();
  }
  clearSession();
  return null;
}

/** Where to sign in: the shop's hosted sign-in page, which comes back here afterwards. */
export const signInHref = (returnTo = location.pathname + location.search) => '/login?return_to=' + encodeURIComponent(returnTo);

/** Signs out of this site only (revokes our tokens, keeps the fan's Ztor session), then goes to `returnTo`. */
export async function signOut(returnTo = '/') {
  const session = stored();
  clearSession();
  if (session) {
    try {
      const { revocation_endpoint } = await discover();
      for (const [token, hint] of [[session.refreshToken, 'refresh_token'], [session.accessToken, 'access_token']]) {
        if (!revocation_endpoint || !token) continue;
        await fetch(revocation_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, token_type_hint: hint, client_id: config.clientId }) });
      }
    } catch {
      // Best effort: the token dies at expiry anyway; the local session is already gone.
    }
  }
  location.assign(returnTo);
}
