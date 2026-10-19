"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { Cover } from "@/components/Cover";
import { coverImage } from "@/lib/media";
import { errorText, isAuthError, money, shop, type Cart } from "@/lib/shop";

export default function CartPage() {
  const t = useT();
  const skeleton = <Loading label={t.cart.loading}><LinesSkeleton rows={2} summary /></Loading>;
  return (
    <>
      <h1>{t.cart.title}</h1>
      <Gate title={t.cart.signInToSee} fallback={skeleton}>{(session) => <CartView session={session} />}</Gate>
    </>
  );
}

function CartView({ session }: { session: Session }) {
  const t = useT();
  const skeleton = <Loading label={t.cart.loading}><LinesSkeleton rows={2} summary /></Loading>;
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
      <SignInPrompt title={t.common.signInAgain} text={t.common.signInNotCover} />
    ) : (
      <StateMessage
        tone="error"
        title={t.cart.couldntLoad}
        actions={
          <button className="btn btn-primary" onClick={() => { setError(null); setCart(null); void load(); }}>
            <Icon name="refresh" />
            {t.common.tryAgain}
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
      <StateMessage icon="bag" title={t.cart.empty} actions={<Link href="/" className="btn btn-primary">{t.cart.browse}</Link>}>
        <p>{t.cart.emptyBody}</p>
      </StateMessage>
    );
  const payable = lines.filter((l) => l.itemStatus === "AVAILABLE");
  const currency = cart.shopGroups[0]?.currency;
  const subtotal = payable.reduce((n, l) => n + (l.lineSubtotal ?? 0), 0);
  return (
    <div className="with-summary">
      <ul className="lines" role="list" aria-busy={pending}>
        {lines.map((l) => {
          const title = l.title ?? t.cart.product;
          const options = l.skuSelections.map((s) => s.skuLabel).filter(Boolean).join(" · ");
          return (
            <li key={l.cartItemId} className="line line-cart">
              <Cover className="line-thumb" src={coverImage(l.coverUrl)} alt="" width={88} height={88} loading="lazy" decoding="async" />
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
                <div className="qty" role="group" aria-label={t.cart.qtyOf(title)}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void mutate(() => (l.quantity > 1 ? shop.setQty(session.accessToken, l.cartItemId, l.quantity - 1) : shop.removeLine(session.accessToken, l.cartItemId)))}
                    aria-label={l.quantity > 1 ? t.product.decrease : t.cart.removeFromCart}
                  >
                    <Icon name={l.quantity > 1 ? "minus" : "trash"} />
                  </button>
                  <span aria-live="polite">{l.quantity}</span>
                  <button
                    type="button"
                    disabled={pending || (l.maxQuantity != null && l.quantity >= l.maxQuantity)}
                    onClick={() => void mutate(() => shop.setQty(session.accessToken, l.cartItemId, l.quantity + 1))}
                    aria-label={t.product.increase}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => void mutate(() => shop.removeLine(session.accessToken, l.cartItemId))}>
                  <Icon name="trash" />
                  {t.cart.remove}<span className="sr-only"> {title}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="summary" aria-label={t.cart.summary}>
        <div className="summary-row summary-total">
          <span>{t.cart.subtotal}</span>
          <span>{money(subtotal, currency)}</span>
        </div>
        {payable.length < lines.length ? (
          <p className="summary-note">
            <Icon name="alert" />
            {payable.length ? t.cart.unavailableLeftOut : t.cart.noneBuyable}
          </p>
        ) : null}
        {payable.length ? (
          <Link href="/checkout" className="btn btn-primary btn-lg btn-block">{t.cart.checkout}</Link>
        ) : (
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled>{t.cart.checkout}</button>
        )}
      </aside>
    </div>
  );
}
