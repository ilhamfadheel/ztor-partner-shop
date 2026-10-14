"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { currentSession, REFRESH_EARLY_MS, type Session } from "@/lib/oidc";
import { loginHref } from "@/lib/login-href";
import { shop } from "@/lib/shop";
import { Icon } from "./Icon";
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

/**
 * The lloud.club fan-club header: mark + FAN CLUB on the left, the sections in the middle (a row of
 * their own on phones), account and bag on the right. Account and bag always show; signed out they
 * lead to the sign-in page, which brings the fan back to where they were going.
 */
export function Header() {
  const session = useSession();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState<number | null>(null);
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
          <span className="brand-name">Fan Club</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/" className="nav-link" aria-current={current(pathname === "/" || pathname.startsWith("/products"))}>Shop</Link>
          <Link href={gated("/orders")} className="nav-link" aria-current={current(pathname.startsWith("/orders"))}>Orders</Link>
        </nav>
        <div className="header-actions">
          <Link href={gated("/account")} className="icon-link" aria-current={current(pathname.startsWith("/account"))}>
            <Icon name="user" />
            <span className="sr-only">{session ? `Your account (${who})` : "Sign in"}</span>
          </Link>
          <Link href={gated("/cart")} className="icon-link" aria-current={current(pathname === "/cart")}>
            <span className="nav-icon">
              <Icon name="bag" />
              {cartCount ? <span className="badge" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </span>
            <span className="sr-only">Bag{cartCount ? `, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : ""}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
