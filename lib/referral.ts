/**
 * Invitations (Creator API Invites, CONTRACT §5.4): a friend lands on `/signup?ref=<code>`, the code
 * is kept in this browser for 7 days, and right after the friend's token exchange the callback names
 * it once (`POST /creator/v1/invites/claim`). Nothing about the sign-in itself changes. The LLOUD
 * pages keep the same rule in public/js/ztor/referral.js — keep the two in step.
 */
export const REF_KEY = "ztor_ref";
export const REF_TTL_MS = 7 * 24 * 60 * 60_000;
const REF = /^[0-9A-Za-z-]{4,32}$/;

/** Keeps `?ref=` when it looks like an invitation code; returns it, or null. */
export function captureRef(search: string, now = Date.now()): string | null {
  const code = new URLSearchParams(search).get("ref");
  if (!code || !REF.test(code)) return null;
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code, at: now }));
  } catch {
    return null; // storage off: the invitation can't follow the friend
  }
  return code;
}

/** The invitation waiting to be claimed, or null (none, unreadable, or older than 7 days). */
export function pendingRef(now = Date.now()): string | null {
  try {
    const kept = JSON.parse(localStorage.getItem(REF_KEY) ?? "null") as { code?: unknown; at?: unknown } | null;
    if (!kept || typeof kept.code !== "string" || !REF.test(kept.code) || typeof kept.at !== "number") return null;
    return now - kept.at > REF_TTL_MS ? null : kept.code;
  } catch {
    return null;
  }
}

export function clearRef(): void {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    // storage off: nothing kept
  }
}

/**
 * Names the pending invitation once with `claim` (the fan's token is the caller's). Forgets it on an
 * answer (counted, or any 4xx refusal); keeps it for the next sign-in on a 5xx, a network error, or
 * no answer within `timeoutMs` — so the sign-in is never held up or failed by it.
 */
export async function claimPendingRef(
  claim: (code: string) => Promise<unknown>,
  { timeoutMs = 4_000 }: { timeoutMs?: number } = {},
): Promise<"none" | "counted" | "refused" | "kept"> {
  const code = pendingRef();
  if (!code) return "none";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((resolve) => (timer = setTimeout(() => resolve("late"), timeoutMs)));
  try {
    if ((await Promise.race([claim(code), late])) === "late") return "kept";
    clearRef();
    return "counted";
  } catch (error) {
    const status = (error as { status?: unknown })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      clearRef();
      return "refused";
    }
    return "kept";
  } finally {
    clearTimeout(timer);
  }
}
