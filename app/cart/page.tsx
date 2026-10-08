"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type Cart } from "@/lib/shop";

export default function CartPage() {
  return (
    <>
      <h1>Cart</h1>
      <Gate>{(session) => <CartView session={session} />}</Gate>
    </>
  );
}

function CartView({ session }: { session: Session }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => shop.cart(session.accessToken).then(setCart).catch(setError), [session.accessToken]);
  useEffect(() => void load(), [load]);

  async function mutate(run: () => Promise<unknown>) {
    try {
      await run();
      await load();
      window.dispatchEvent(new Event("ztor-cart"));
    } catch (e) {
      setError(e);
    }
  }

  if (error) return isAuthError(error) ? <SignInPrompt text="Your Ztor sign-in doesn’t cover this shop yet — sign in again." /> : <p className="notice error">{errorText(error)}</p>;
  if (!cart) return <p className="muted">Loading…</p>;
  const lines = cart.shopGroups.flatMap((g) => g.items.map((i) => ({ ...i, currency: g.currency })));
  if (lines.length === 0)
    return (
      <p className="notice">
        Your cart is empty. <Link href="/" style={{ textDecoration: "underline" }}>Browse the shop</Link>
      </p>
    );
  const payable = lines.filter((l) => l.itemStatus === "AVAILABLE");
  const currency = cart.shopGroups[0]?.currency;
  const subtotal = payable.reduce((n, l) => n + (l.lineSubtotal ?? 0), 0);
  return (
    <>
      <div className="lines">
        {lines.map((l) => (
          <div key={l.cartItemId} className="line">
            {l.coverUrl ? <img src={l.coverUrl} alt="" /> : <div />}
            <div className="meta">
              <Link href={`/products/${l.productId}`} className="title">{l.title ?? "Product"}</Link>
              <span className="tag">{l.skuSelections.map((s) => s.skuLabel).filter(Boolean).join(" · ")}</span>
              {l.itemStatus !== "AVAILABLE" ? <span className="tag" style={{ color: "var(--danger)" }}>{l.itemStatus.replaceAll("_", " ").toLowerCase()}</span> : null}
              <span className="price">{money(l.lineSubtotal, l.currency)}</span>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div className="qty">
                <button onClick={() => void mutate(() => (l.quantity > 1 ? shop.setQty(session.accessToken, l.cartItemId, l.quantity - 1) : shop.removeLine(session.accessToken, l.cartItemId)))} aria-label="Fewer">−</button>
                <span>{l.quantity}</span>
                <button onClick={() => void mutate(() => shop.setQty(session.accessToken, l.cartItemId, l.quantity + 1))} disabled={l.maxQuantity != null && l.quantity >= l.maxQuantity} aria-label="More">+</button>
              </div>
              <button className="btn btn-sm" onClick={() => void mutate(() => shop.removeLine(session.accessToken, l.cartItemId))}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="summary">
        <div className="row total"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
        <Link href="/checkout" className="btn btn-primary" aria-disabled={payable.length === 0}>Checkout</Link>
      </div>
    </>
  );
}
