"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "./Header";
import { Icon } from "./Icon";
import { signIn } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type ProductDetail } from "@/lib/shop";

/** Option chips → one SKU → quantity → the cart. Signed-out fans are sent to "Continue with Ztor" and come back here. */
export function AddToCart({ product }: { product: ProductDetail }) {
  const session = useSession();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; error?: string }>({});

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
      setState({ error: isAuthError(e) ? "Your Ztor sign-in doesn’t cover this shop yet. Sign in again." : errorText(e) });
    }
  }

  if (product.productStructure === "BUNDLE")
    return (
      <p className="notice">
        <Icon name="alert" />
        <span>Bundles can’t be added from this site yet.</span>
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
            {!sku.sellable ? <span className="status-chip">{sku.availabilityStatus.replaceAll("_", " ").toLowerCase()}</span> : null}
          </>
        ) : (
          <span className="meta">Choose your options</span>
        )}
      </p>
      <div className="buy-row">
        <div className="qty" role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
            <Icon name="minus" />
          </button>
          <span aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Increase quantity">
            <Icon name="plus" />
          </button>
        </div>
        <button className="btn btn-primary btn-lg" type="button" disabled={!sku || !sku.sellable || state.busy} onClick={() => void add()}>
          {session === null ? (
            "Continue with Ztor to buy"
          ) : state.busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Adding…
            </>
          ) : (
            "Add to cart"
          )}
        </button>
      </div>
      <div aria-live="polite">
        {state.ok ? (
          <p className="notice" data-tone="success">
            <Icon name="check-circle" />
            <span>
              Added to your cart. <Link href="/cart" className="link">View cart</Link>
            </span>
          </p>
        ) : null}
        {state.error ? (
          <div className="notice" data-tone="error">
            <Icon name="alert" />
            <div className="notice-body">
              <span>{state.error}</span>
              {state.error.includes("Sign in again") ? <button className="btn" onClick={() => void signIn()}>Sign in</button> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
