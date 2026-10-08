"use client";
import { useState } from "react";
import { useSession } from "./Header";
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

  if (product.productStructure === "BUNDLE") return <p className="notice">Bundles can’t be added from this site yet.</p>;
  return (
    <div className="options">
      {product.options.map((o) => (
        <div key={o.optionId}>
          <p className="tag" style={{ margin: "0 0 6px" }}>{o.optionName}{picked[o.optionId] ? `: ${o.values.find((v) => v.optionValueId === picked[o.optionId])?.valueName}` : ""}</p>
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
      {sku ? (
        <p style={{ margin: 0 }}>
          <span className="price">{money(sku.effectivePrice, product.currency)}</span>
          {sku.originalPrice && sku.originalPrice > sku.effectivePrice ? <s className="muted" style={{ marginLeft: 8 }}>{money(sku.originalPrice, product.currency)}</s> : null}
          {!sku.sellable ? <span className="tag" style={{ marginLeft: 8 }}>{sku.availabilityStatus.replaceAll("_", " ").toLowerCase()}</span> : null}
        </p>
      ) : (
        <p className="tag" style={{ margin: 0 }}>Choose your options</p>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="qty">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer">−</button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="More">+</button>
        </div>
        <button className="btn btn-primary" type="button" disabled={!sku || !sku.sellable || state.busy} onClick={() => void add()}>
          {session === null ? "Continue with Ztor to buy" : state.busy ? "Adding…" : "Add to cart"}
        </button>
      </div>
      {state.ok ? <p className="notice ok" style={{ margin: 0 }}>Added. <a href="/cart" style={{ textDecoration: "underline" }}>View cart</a></p> : null}
      {state.error ? (
        <p className="notice error" style={{ margin: 0 }}>
          {state.error}
          {state.error.includes("Sign in again") ? <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void signIn()}>Sign in</button> : null}
        </p>
      ) : null}
    </div>
  );
}
