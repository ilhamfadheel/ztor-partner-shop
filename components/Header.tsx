"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession, signIn, signOut, type Session } from "@/lib/oidc";
import { shop, type Artist } from "@/lib/shop";

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
  const [artist, setArtist] = useState<Artist | null>(null);
  const [cartCount, setCartCount] = useState<number | null>(null);
  useEffect(() => {
    shop.artist().then((artists) => setArtist(artists[0] ?? null)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!session) return setCartCount(null);
    shop.cart(session.accessToken).then((cart) => setCartCount(cart.shopGroups.reduce((n, g) => n + g.items.length, 0))).catch(() => setCartCount(null));
    const refresh = () => shop.cart(session.accessToken).then((cart) => setCartCount(cart.shopGroups.reduce((n, g) => n + g.items.length, 0))).catch(() => {});
    window.addEventListener("ztor-cart", refresh);
    return () => window.removeEventListener("ztor-cart", refresh);
  }, [session]);
  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="brand">
          {artist?.avatarUrl ? <img src={artist.avatarUrl} alt="" /> : null}
          <span>{artist?.name || "Shop"}</span>
        </Link>
        <nav className="nav">
          <Link href="/">Shop</Link>
          {session ? (
            <>
              <Link href="/cart">Cart {cartCount ? <span className="badge">{cartCount}</span> : null}</Link>
              <Link href="/orders">Orders</Link>
              <span className="muted">{session.user.name || session.user.email}</span>
              <button className="btn btn-sm" onClick={() => void signOut()}>Sign out</button>
            </>
          ) : session === null ? (
            <button className="btn btn-primary btn-sm" data-ztor-signin onClick={() => void signIn()}>Continue with Ztor</button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
