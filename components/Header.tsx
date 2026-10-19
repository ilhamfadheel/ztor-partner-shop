"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentSession, REFRESH_EARLY_MS, type Session } from "@/lib/oidc";
import { loginHref } from "@/lib/login-href";
import { shop } from "@/lib/shop";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";
import { Logo } from "./Logo";

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

/** How often an open page asks for new notifications; also on coming back to the tab, and after reading some. */
const NOTIFICATIONS_POLL_MS = 60_000;

/** The fan's unread notifications on this site (the bell's badge); null signed out or unknown. */
function useUnread(session: Session | null | undefined): number | null {
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    if (!session) return setUnread(null);
    const read = () =>
      void shop
        .notifications(session.accessToken, 1, 1)
        .then((page) => setUnread(page.unread))
        .catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && read();
    read();
    const timer = setInterval(read, NOTIFICATIONS_POLL_MS);
    window.addEventListener("ztor-notifications", read);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("ztor-notifications", read);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);
  return unread;
}

/**
 * The lloud.club fan-club header: mark + FAN CLUB on the left, the sections in the middle (a row of
 * their own on phones), account, notifications and bag on the right. All three always show; signed out they
 * lead to the sign-in page, which brings the fan back to where they were going.
 */
export function Header() {
  const t = useT();
  const session = useSession();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState<number | null>(null);
  const unread = useUnread(session);
  useEffect(() => {
    if (!session) return setCartCount(null);
    const read = () => shop.cart(session.accessToken).then((cart) => setCartCount(cart.shopGroups.reduce((n, g) => n + g.items.length, 0))).catch(() => {});
    read();
    window.addEventListener("ztor-cart", read);
    return () => window.removeEventListener("ztor-cart", read);
  }, [session]);

  const current = (active: boolean) => (active ? ("page" as const) : undefined);
  const gated = (path: string) => (session === null ? loginHref(path) : path);
  const who = session ? session.user.name || session.user.email || "" : "";
  return (
    <header className="header">
      <div className="header-bar">
        <Link href="/" className="brand">
          <Logo />
          <span className="brand-name">{t.layout.siteName}</span>
        </Link>
        <nav className="nav" aria-label={t.header.mainNav}>
          <Link href="/" className="nav-link" aria-current={current(pathname === "/" || pathname.startsWith("/products"))}>{t.header.shop}</Link>
          <Link href={gated("/orders")} className="nav-link" aria-current={current(pathname.startsWith("/orders"))}>{t.header.orders}</Link>
        </nav>
        <div className="header-actions">
          <Link href={gated("/account")} className="icon-link" aria-current={current(pathname.startsWith("/account"))}>
            <Icon name="user" />
            <span className="sr-only">{session ? t.header.yourAccount(who) : t.common.signIn}</span>
          </Link>
          <Link href={gated("/notifications")} className="icon-link" aria-current={current(pathname === "/notifications")}>
            <span className="nav-icon">
              <Icon name="bell" />
              {unread ? <span className="badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
            </span>
            <span className="sr-only">{t.header.notifications}{unread ? t.header.unreadSuffix(unread) : ""}</span>
          </Link>
          <Link href={gated("/cart")} className="icon-link" aria-current={current(pathname === "/cart")}>
            <span className="nav-icon">
              <Icon name="bag" />
              {cartCount ? <span className="badge" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </span>
            <span className="sr-only">{t.header.bag}{cartCount ? t.header.bagCount(cartCount) : ""}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
