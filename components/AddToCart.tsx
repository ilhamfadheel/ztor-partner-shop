"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "./Header";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";
import { signIn } from "@/lib/oidc";
import { isSoldOut } from "@/lib/availability";
import { errorText, isAuthError, money, shop, type ProductDetail } from "@/lib/shop";

/** Option chips → one SKU → quantity → the cart. Signed-out fans are sent to "Continue with Ztor" and come back here. */
export function AddToCart({ product }: { product: ProductDetail }) {
  const t = useT();
  const session = useSession();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; error?: string; authError?: boolean }>({});

  const sku =
    product.options.length === 0
      ? product.skus[0]
      : product.skus.find((s) => product.options.every((o) => s.selectedOptions.some((so) => so.optionId === o.optionId && so.optionValueId === picked[o.optionId])));
  /** A value is pickable if some sellable SKU has it together with the other picked values. */
  const available = (optionId: string, valueId: string) =>
    product.skus.some(
      (s) =>
        s.sellable &&
        s.selectedOptions.some((so) => so.optionId === optionId && so.optionValueId === valueId) &&
        product.options.every((o) => o.optionId === optionId || !picked[o.optionId] || s.selectedOptions.some((so) => so.optionId === o.optionId && so.optionValueId === picked[o.optionId])),
    );
  // Sold out by Ztor's rule (not sellable, or no stock), the product as a whole or the picked SKU.
  const soldOut = isSoldOut(product) || (sku ? isSoldOut(sku) : false);
  const max = Math.min(99, product.purchaseLimit || 99, sku?.stockQuantity ?? 99);

  async function add() {
    if (!sku) return;
    if (!session) return signIn();
    setState({ busy: true });
    try {
      await shop.addToCart(session.accessToken, { product_id: product.productId, sku_id: sku.skuId, qty });
      window.dispatchEvent(new Event("ztor-cart"));
      setState({ ok: true });
    } catch (e) {
      setState({ error: isAuthError(e) ? `${t.common.signInNotCover} ${t.common.signInAgain}` : errorText(e), authError: isAuthError(e) });
    }
  }

  if (product.productStructure === "BUNDLE")
    return (
      <p className="notice">
        <Icon name="alert" />
        <span>{t.product.bundles}</span>
      </p>
    );
  return (
    <div className="options">
      {product.options.map((o) => (
        <div key={o.optionId} className="option-group" role="group" aria-labelledby={`option-${o.optionId}`}>
          <p id={`option-${o.optionId}`} className="option-label">
            {o.optionName}
            {picked[o.optionId] ? <>: <strong>{o.values.find((v) => v.optionValueId === picked[o.optionId])?.valueName}</strong></> : null}
          </p>
          <div className="chips">
            {o.values.map((v) => (
              <button
                key={v.optionValueId}
                type="button"
                className="chip"
                aria-pressed={picked[o.optionId] === v.optionValueId}
                disabled={!available(o.optionId, v.optionValueId)}
                onClick={() => setPicked((p) => ({ ...p, [o.optionId]: v.optionValueId }))}
              >
                {v.valueName}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="price-row" aria-live="polite">
        {sku ? (
          <>
            <span className="price">{money(sku.effectivePrice, product.currency)}</span>
            {sku.originalPrice && sku.originalPrice > sku.effectivePrice ? <s className="meta">{money(sku.originalPrice, product.currency)}</s> : null}
            {soldOut ? <span className="status-chip">{t.home.soldOut}</span> : null}
          </>
        ) : (
          <span className="meta">{t.product.chooseOptions}</span>
        )}
      </p>
      <div className="buy-row">
        <div className="qty" role="group" aria-label={t.product.quantity}>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={soldOut || qty <= 1} aria-label={t.product.decrease}>
            <Icon name="minus" />
          </button>
          <span aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={soldOut || qty >= max} aria-label={t.product.increase}>
            <Icon name="plus" />
          </button>
        </div>
        <button className="btn btn-primary btn-lg" type="button" disabled={!sku || soldOut || state.busy} onClick={() => void add()}>
          {soldOut ? (
            t.home.soldOut
          ) : session === null ? (
            t.product.continueToBuy
          ) : state.busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.product.adding}
            </>
          ) : (
            t.product.addToCart
          )}
        </button>
      </div>
      <div aria-live="polite">
        {state.ok ? (
          <p className="notice" data-tone="success">
            <Icon name="check-circle" />
            <span>
              {t.product.added}<Link href="/cart" className="link">{t.product.viewCart}</Link>
            </span>
          </p>
        ) : null}
        {state.error ? (
          <div className="notice" data-tone="error">
            <Icon name="alert" />
            <div className="notice-body">
              <span>{state.error}</span>
              {state.authError ? <button className="btn" onClick={() => void signIn()}>{t.common.signIn}</button> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
