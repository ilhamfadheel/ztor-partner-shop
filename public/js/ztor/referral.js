// Invitations, for the LLOUD pages: the same rule as lib/referral.ts (keep the two in step). A friend
// lands on /signup?ref=<code>; the code is kept for 7 days and claimed once by /auth/callback right
// after the friend's token exchange.
export const REF_KEY = 'ztor_ref';
export const REF_TTL_MS = 7 * 24 * 60 * 60_000;
const REF = /^[0-9A-Za-z-]{4,32}$/;

/** Keeps `?ref=` when it looks like an invitation code; returns it, or null. */
export function captureRef(search, now = Date.now()) {
  const code = new URLSearchParams(search).get('ref');
  if (!code || !REF.test(code)) return null;
  try { localStorage.setItem(REF_KEY, JSON.stringify({ code, at: now })); } catch { return null; }
  return code;
}

/** The invitation waiting to be claimed, or null (none, unreadable, or older than 7 days). */
export function pendingRef(now = Date.now()) {
  try {
    const kept = JSON.parse(localStorage.getItem(REF_KEY) ?? 'null');
    if (!kept || typeof kept.code !== 'string' || !REF.test(kept.code) || typeof kept.at !== 'number') return null;
    return now - kept.at > REF_TTL_MS ? null : kept.code;
  } catch { return null; }
}

export function clearRef() {
  try { localStorage.removeItem(REF_KEY); } catch { /* storage off */ }
}
