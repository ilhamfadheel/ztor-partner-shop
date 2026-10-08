"use client";
import { useEffect, useMemo, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type Cart, type PaymentMethod, type PickupContact, type Quote } from "@/lib/shop";

export const PENDING_GROUP = "ztor_pending_group";

export default function CheckoutPage() {
  return (
    <>
      <h1>Checkout</h1>
      <Gate>{(session) => <Checkout session={session} />}</Gate>
    </>
  );
}

/** Quote → pickup contact → payment method → submit → off to the payment page; /checkout/done picks it up. */
function Checkout({ session }: { session: Session }) {
  const token = session.accessToken;
  const [cart, setCart] = useState<Cart | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [contacts, setContacts] = useState<PickupContact[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [contactId, setContactId] = useState<string>("new");
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [method, setMethod] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  // One key per checkout attempt: a retry after a network blip replays, a changed selection gets a new one.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const lineIds = useMemo(() => cart?.shopGroups.flatMap((g) => g.items.filter((i) => i.itemStatus === "AVAILABLE").map((i) => i.cartItemId)) ?? [], [cart]);

  useEffect(() => {
    shop.cart(token).then(setCart).catch(setError);
    shop.pickupContacts(token).then((items) => { setContacts(items); if (items[0]) setContactId(items[0].contactId); }).catch(setError);
    shop.paymentMethods(token).then((m) => { setMethods(m); if (m[0]) setMethod(m[0].methodCode); }).catch(setError);
  }, [token]);
  useEffect(() => {
    if (lineIds.length) shop.quote(token, lineIds).then(setQuote).catch(setError);
  }, [token, lineIds]);

  async function submit() {
    if (!quote?.confirmationHash || !method) return;
    setBusy(true);
    try {
      const pickup = contactId === "new" ? { pickup_contact: { name: contact.name.trim(), phone: contact.phone.trim() } } : { pickup_contact_id: contactId };
      const result = await shop.checkout(token, { cart_item_ids: lineIds, payment_method: method, confirmation_hash: quote.confirmationHash, callback_url: `${location.origin}/checkout/done`, ...pickup }, idempotencyKey);
      sessionStorage.setItem(PENDING_GROUP, result.group.checkoutGroupId);
      window.dispatchEvent(new Event("ztor-cart"));
      if (result.paymentAction === "ACTION_REQUIRED" && result.paymentUrl && /^https:\/\//.test(result.paymentUrl)) location.assign(result.paymentUrl);
      else location.assign("/checkout/done");
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (error) return isAuthError(error) ? <SignInPrompt text="Your Ztor sign-in doesn’t cover this shop yet — sign in again." /> : <p className="notice error">{errorText(error)}</p>;
  if (!cart) return <p className="muted">Loading…</p>;
  if (lineIds.length === 0) return <p className="notice">Nothing to pay for — your cart has no available items.</p>;
  const newContactOk = contactId !== "new" || (contact.name.trim() && contact.phone.trim());
  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0,1fr) minmax(280px,360px)" }}>
      <div className="form" style={{ maxWidth: "none" }}>
        <h2 style={{ margin: 0 }}>Pickup contact</h2>
        {contacts.map((c) => (
          <label key={c.contactId} className="radio">
            <input type="radio" name="contact" checked={contactId === c.contactId} onChange={() => setContactId(c.contactId)} />
            <span>{c.name} · {c.phone}</span>
          </label>
        ))}
        <label className="radio">
          <input type="radio" name="contact" checked={contactId === "new"} onChange={() => setContactId("new")} />
          <span>New contact</span>
        </label>
        {contactId === "new" ? (
          <>
            <div className="field"><label htmlFor="name">Name</label><input id="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></div>
          </>
        ) : null}
        <h2 style={{ margin: "12px 0 0" }}>Payment</h2>
        {methods.length === 0 ? <p className="muted">No payment methods available.</p> : null}
        {methods.map((m) => (
          <label key={m.methodCode} className="radio">
            <input type="radio" name="method" checked={method === m.methodCode} onChange={() => setMethod(m.methodCode)} />
            <span>{m.displayName}</span>
          </label>
        ))}
      </div>
      <div className="summary" style={{ marginTop: 0, alignSelf: "start" }}>
        {cart.shopGroups.flatMap((g) => g.items).filter((i) => i.itemStatus === "AVAILABLE").map((i) => (
          <div key={i.cartItemId} className="row"><span className="muted">{i.title} × {i.quantity}</span><span>{money(i.lineSubtotal, quote?.currency)}</span></div>
        ))}
        {quote?.discountAmount ? <div className="row"><span className="muted">Discount</span><span>−{money(quote.discountAmount, quote.currency)}</span></div> : null}
        <div className="row total"><span>Total</span><span>{quote ? money(quote.payableAmount, quote.currency) : "…"}</span></div>
        <button className="btn btn-primary" disabled={busy || !quote?.confirmationHash || !quote.canCreate || !method || !newContactOk} onClick={() => void submit()}>
          {busy ? "Taking you to payment…" : "Pay now"}
        </button>
        <span className="tag">You’ll pay on Ztor’s secure payment page and come straight back here.</span>
      </div>
    </div>
  );
}
