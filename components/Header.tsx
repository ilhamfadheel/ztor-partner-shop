"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSession, signIn, signOut, type Session } from "@/lib/oidc";
import { shop, type Artist } from "@/lib/shop";
import { Icon } from "./Icon";

/** Reads the browser session; re-renders on sign-in/out (same tab via our event, other tabs via `storage`). */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setSession(getSession());
    read();
    window.addEventListener("ztor-session", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("ztor-session", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return session;
}

export function Header() {
  const session = useSession();
  const pathname = usePathname();
  // undefined = still loading (reserve the avatar + name slot), null = no artist answer (fall back to "Shop").
  const [artist, setArtist] = useState<Artist | null | undefined>(undefined);
  const [cartCount, setCartCount] = useState<number | null>(null);
  const account = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    shop.artist().then((artists) => setArtist(artists[0] ?? null)).catch(() => setArtist(null));
  }, []);
  useEffect(() => {
    if (!session) return setCartCount(null);
    shop.cart(session.accessToken).then((cart) => setCartCount(cart.shopGroups.reduce((n, g) => n + g.items.length, 0))).catch(() => setCartCount(null));
    const refresh = () => shop.cart(session.accessToken).then((cart) => setCartCount(cart.shopGroups.reduce((n, g) => n + g.items.length, 0))).catch(() => {});
    window.addEventListener("ztor-cart", refresh);
    return () => window.removeEventListener("ztor-cart", refresh);
  }, [session]);

  // The account menu is a native <details> (tap to open, keyboard-operable); close it on navigation, outside tap and Escape.
  useEffect(() => {
    if (account.current) account.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (e: Event) => {
      const menu = account.current;
      if (!menu?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
      } else if (!menu.contains(e.target as Node)) menu.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const current = (active: boolean) => (active ? ("page" as const) : undefined);
  const who = session ? session.user.name || session.user.email : "";
  return (
    <header className="header">
      <div className="container header-bar">
        <Link href="/" className="brand">
          {artist === undefined ? (
            <>
              <span className="avatar skeleton" aria-hidden="true" />
              <span className="brand-skeleton skeleton" aria-hidden="true" />
              <span className="sr-only">Shop</span>
            </>
          ) : (
            <>
              {artist?.avatarUrl ? <img className="avatar" src={artist.avatarUrl} alt="" width={32} height={32} /> : null}
              <span className="brand-name">{artist?.name || "Shop"}</span>
            </>
          )}
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/" className="nav-link nav-shop" aria-current={current(pathname === "/" || pathname.startsWith("/products"))}>
            <Icon name="grid" />
            <span className="nav-label">Shop</span>
          </Link>
          {session ? (
            <>
              <Link href="/cart" className="nav-link" aria-current={current(pathname === "/cart")}>
                <span className="nav-icon">
                  <Icon name="bag" />
                  {cartCount ? <span className="badge" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span> : null}
                </span>
                <span className="nav-label">Cart</span>
                {cartCount ? <span className="sr-only">, {cartCount} {cartCount === 1 ? "item" : "items"}</span> : null}
              </Link>
              <Link href="/orders" className="nav-link" aria-current={current(pathname.startsWith("/orders"))}>
                <Icon name="package" />
                <span className="nav-label">Orders</span>
              </Link>
              <details className="account" ref={account}>
                <summary className="nav-link">
                  <Icon name="user" />
                  <span className="sr-only">Account: </span>
                  <span className="nav-label account-name">{who}</span>
                  <span className="account-chevron"><Icon name="chevron-down" /></span>
                </summary>
                <div className="account-menu">
                  <p className="account-who">
                    <span className="meta">Signed in as</span>
                    <strong>{who}</strong>
                  </p>
                  <button className="btn btn-block" onClick={() => void signOut()}>
                    <Icon name="log-out" />
                    Sign out
                  </button>
                </div>
              </details>
            </>
          ) : session === null ? (
            <button className="btn btn-primary" data-ztor-signin onClick={() => void signIn()}>Continue with Ztor</button>
          ) : (
            <span className="nav-skeleton skeleton" aria-hidden="true" />
          )}
        </nav>
      </div>
    </header>
  );
}
