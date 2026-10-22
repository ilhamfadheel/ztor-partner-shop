"use client";
import { useEffect, useState } from "react";
import { currentSession, REFRESH_EARLY_MS, type Session } from "@/lib/oidc";
import { shop } from "@/lib/shop";
import { useT } from "@/components/LangProvider";
import type { Messages } from "@/lib/i18n";

/**
 * Reads the browser session; re-renders on sign-in/out (same tab via our event, other tabs via
 * `storage`). Keeps it alive while the page is open: the access token is renewed a minute before it
 * runs out, and again on coming back to a tab whose timer slept (a closed laptop).
 */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () =>
      void currentSession().then((s) => {
        if (!live) return;
        setSession(s);
        clearTimeout(timer);
        if (s?.refreshToken) timer = setTimeout(read, Math.max(0, s.expiresAt - REFRESH_EARLY_MS - Date.now()));
      });
    const onVisible = () => document.visibilityState === "visible" && read();
    read();
    window.addEventListener("ztor-session", read);
    window.addEventListener("storage", read);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener("ztor-session", read);
      window.removeEventListener("storage", read);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return session;
}

/** lloud.club's sections, the same five the LLOUD pages' header shows (public/js/club.js mountHeader). */
const SECTIONS = [
  ["/fan-club", (t: Messages) => t.header.fanClub],
  ["/rewards", (t: Messages) => t.header.missions],
  ["/shop", (t: Messages) => t.header.shop],
  ["/auction", (t: Messages) => t.header.auction],
  ["/leaderboard", (t: Messages) => t.header.leaderboard],
] as const;

/** lloud.club's icons (public/js/util.js ICONS). */
const ACCOUNT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20v-2a7 7 0 0 1 14 0v2" />
  </svg>
);
const BAG_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

/**
 * The LLOUD pages' header on the React pages too (orders, notifications, sign-in, payment
 * return): the same markup and classes as public/js/club.js mountHeader, styled by LLOUD's own
 * public/css/club.css (loaded by the layout) — logo + FAN CLUB, the five sections, RUNWAY, the
 * account (sign-up when signed out) and the bag (opens on the shop page).
 */
export function Header() {
  const t = useT();
  const session = useSession();
  const [bag, setBag] = useState(0);
  // Where sign-up brings the fan back to: this page (read after mount; the layout is static).
  const [here, setHere] = useState("/");
  useEffect(() => {
    // On the sign-in page itself, the way back is where that page was going to send the fan.
    const onLogin = location.pathname === "/login";
    setHere(onLogin ? new URLSearchParams(location.search).get("return_to") || "/fan-club" : location.pathname + location.search);
  }, []);
  useEffect(() => {
    if (!session) return setBag(0);
    // The bag's count as the LLOUD header counts it: pieces, not lines.
    const read = () => shop.cart(session.accessToken).then((cart) => setBag(cart.shopGroups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.quantity, 0), 0))).catch(() => {});
    read();
    window.addEventListener("ztor-cart", read);
    return () => window.removeEventListener("ztor-cart", read);
  }, [session]);

  const account = session ? "/account" : `/signup?return=${encodeURIComponent(here)}`;
  const accountLabel = session ? t.header.accountLink : t.header.joinOrSignIn;
  const bagLabel = bag ? t.header.shoppingBagCount(bag) : t.header.shoppingBag;
  // Plain links: the LLOUD pages are static files (public/), so these are full page loads.
  return (
    <header className="club-header">
      <div className="club-header-top">
        <a className="club-brand" href="/" aria-label={t.header.backToLloudRunway}>
          <img src="/assets/brand/brand-logo.svg" alt="LLOUD" />
          <span>{t.header.fanClub}</span>
        </a>
        <nav className="club-nav" aria-label={t.header.fanClub}>
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href}>{label(t)}</a>
          ))}
        </nav>
        <div className="club-header-actions">
          <a className="club-runway-link" href="/">{t.header.runway}</a>
          <a className="club-account" href={account} aria-label={accountLabel} title={accountLabel}>{ACCOUNT_ICON}</a>
          <a className="club-bag" href="/shop?view=bag" aria-label={bagLabel}>
            {BAG_ICON}
            <span data-bag-count aria-hidden="true">{bag ? (bag > 99 ? "99+" : String(bag)) : ""}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
