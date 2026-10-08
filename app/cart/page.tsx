"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { mediaUrl } from "@/lib/media";
import { errorText, isAuthError, money, shop, type Cart } from "@/lib/shop";

const skeleton = <Loading label="Loading your cart…"><LinesSkeleton rows={2} summary /></Loading>;

export default function CartPage() {
  return (
    <>
      <h1>Cart</h1>
      <Gate title="Sign in to see your cart" fallback={skeleton}>{(session) => <CartView session={session} />}</Gate>
    </>
  );
}

function CartView({ session }: { session: Session }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(() => shop.cart(session.accessToken).then(setCart).catch(setError), [session.accessToken]);
  useEffect(() => void load(), [load]);

  async function mutate(run: () => Promise<unknown>) {
    setPending(true);
    try {
      await run();
      await load();
      window.dispatchEvent(new Event("ztor-cart"));
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  if (error)
    return isAuthError(error) ? (
      <SignInPrompt title="Sign in again" text="Your Ztor sign-in doesn’t cover this shop yet." />
    ) : (
      <StateMessage
        tone="error"
        title="Couldn’t load your cart"
        actions={
          <button className="btn btn-primary" onClick={() => { setError(null); setCart(null); void load(); }}>
            <Icon name="refresh" />
            Try again
          </button>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!cart) return skeleton;
  const lines = cart.shopGroups.flatMap((g) => g.items.map((i) => ({ ...i, currency: g.currency })));
  if (lines.length === 0)
    return (
      <StateMessage icon="bag" title="Your cart is empty" actions={<Link href="/" className="btn btn-primary">Browse the shop</Link>}>
        <p>Find something you like and it’ll wait for you here.</p>
      </StateMessage>
    );
  const payable = lines.filter((l) => l.itemStatus === "AVAILABLE");
  const currency = cart.shopGroups[0]?.currency;
  const subtotal = payable.reduce((n, l) => n + (l.lineSubtotal ?? 0), 0);
  return (
    <div className="with-summary">
      <ul className="lines" role="list" aria-busy={pending}>
        {lines.map((l) => {
          const title = l.title ?? "Product";
          const options = l.skuSelections.map((s) => s.skuLabel).filter(Boolean).join(" · ");
          return (
            <li key={l.cartItemId} className="line line-cart">
              {mediaUrl(l.coverUrl) ? <img className="line-thumb" src={mediaUrl(l.coverUrl)} alt="" width={88} height={88} loading="lazy" decoding="async" /> : <span className="line-thumb" aria-hidden="true" />}
              <div className="line-meta">
                <Link href={`/products/${l.productId}`} className="line-title">{title}</Link>
                {options ? <span className="meta">{options}</span> : null}
                {l.itemStatus !== "AVAILABLE" ? (
                  <span className="line-status">
                    <Icon name="alert" />
                    <span className="cap">{l.itemStatus.replaceAll("_", " ").toLowerCase()}</span>
                  </span>
                ) : null}
                <span className="price">{money(l.lineSubtotal, l.currency)}</span>
              </div>
              <div className="line-actions">
                <div className="qty" role="group" aria-label={`Quantity of ${title}`}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void mutate(() => (l.quantity > 1 ? shop.setQty(session.accessToken, l.cartItemId, l.quantity - 1) : shop.removeLine(session.accessToken, l.cartItemId)))}
                    aria-label={l.quantity > 1 ? "Decrease quantity" : "Remove from cart"}
                  >
                    <Icon name={l.quantity > 1 ? "minus" : "trash"} />
                  </button>
                  <span aria-live="polite">{l.quantity}</span>
                  <button
                    type="button"
                    disabled={pending || (l.maxQuantity != null && l.quantity >= l.maxQuantity)}
                    onClick={() => void mutate(() => shop.setQty(session.accessToken, l.cartItemId, l.quantity + 1))}
                    aria-label="Increase quantity"
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => void mutate(() => shop.removeLine(session.accessToken, l.cartItemId))}>
                  <Icon name="trash" />
                  Remove<span className="sr-only"> {title}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="summary" aria-label="Cart summary">
        <div className="summary-row summary-total">
          <span>Subtotal</span>
          <span>{money(subtotal, currency)}</span>
        </div>
        {payable.length < lines.length ? (
          <p className="summary-note">
            <Icon name="alert" />
            {payable.length ? "Unavailable items aren’t included." : "None of these items can be bought right now."}
          </p>
        ) : null}
        {payable.length ? (
          <Link href="/checkout" className="btn btn-primary btn-lg btn-block">Checkout</Link>
        ) : (
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled>Checkout</button>
        )}
      </aside>
    </div>
  );
}
