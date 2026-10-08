"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { CheckoutSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type Cart, type PaymentMethod, type PickupContact, type Quote } from "@/lib/shop";

export const PENDING_GROUP = "ztor_pending_group";

const skeleton = <Loading label="Loading checkout…"><CheckoutSkeleton /></Loading>;

export default function CheckoutPage() {
  return (
    <>
      <h1>Checkout</h1>
      <Gate title="Sign in to check out" fallback={skeleton}>{(session) => <Checkout session={session} />}</Gate>
    </>
  );
}

/** Label above, helper text below, error under the field and tied to it with aria-describedby. */
function Field({ id, label, help, error, children }: { id: string; label: string; help: string; error: string | null; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <span className="field-required" aria-hidden="true">*</span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          <Icon name="alert" />
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="field-help">{help}</p>
      )}
    </div>
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
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [method, setMethod] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    setSubmitError(null);
    try {
      const pickup = contactId === "new" ? { pickup_contact: { name: contact.name.trim(), phone: contact.phone.trim() } } : { pickup_contact_id: contactId };
      const result = await shop.checkout(token, { cart_item_ids: lineIds, payment_method: method, confirmation_hash: quote.confirmationHash, callback_url: `${location.origin}/checkout/done`, ...pickup }, idempotencyKey);
      sessionStorage.setItem(PENDING_GROUP, result.group.checkoutGroupId);
      window.dispatchEvent(new Event("ztor-cart"));
      if (result.paymentAction === "ACTION_REQUIRED" && result.paymentUrl && /^https:\/\//.test(result.paymentUrl)) location.assign(result.paymentUrl);
      else location.assign("/checkout/done");
    } catch (e) {
      // Keep the form (and what the fan typed) on screen; only a lost sign-in replaces the page.
      if (isAuthError(e)) setError(e);
      else setSubmitError(errorText(e));
      setBusy(false);
    }
  }

  if (error)
    return isAuthError(error) ? (
      <SignInPrompt title="Sign in again" text="Your Ztor sign-in doesn’t cover this shop yet." />
    ) : (
      <StateMessage
        tone="error"
        title="Couldn’t load checkout"
        actions={
          <>
            <a href="/checkout" className="btn btn-primary">
              <Icon name="refresh" />
              Try again
            </a>
            <Link href="/cart" className="btn">Back to cart</Link>
          </>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!cart) return skeleton;
  if (lineIds.length === 0)
    return (
      <StateMessage icon="bag" title="Nothing to pay for" actions={<Link href="/cart" className="btn btn-primary">Back to cart</Link>}>
        <p>Your cart has no available items.</p>
      </StateMessage>
    );

  const isNew = contactId === "new";
  const nameError = isNew && !contact.name.trim() ? "Enter the name of the person collecting the order." : null;
  const phoneError = isNew && !contact.phone.trim() ? "Enter a phone number so the shop can reach you." : null;
  const describe = (id: string, err: string | null) => (err ? `${id}-error` : `${id}-help`);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameError || phoneError) {
      setTouched({ name: true, phone: true });
      document.getElementById(nameError ? "name" : "phone")?.focus();
      return;
    }
    void submit();
  }

  return (
    <div className="with-summary">
      <form id="checkout-form" className="form" noValidate onSubmit={onSubmit}>
        <fieldset className="fieldset">
          <legend>Pickup contact</legend>
          {contacts.map((c) => (
            <label key={c.contactId} className="choice">
              <input type="radio" name="contact" checked={contactId === c.contactId} onChange={() => setContactId(c.contactId)} />
              <span className="choice-text">
                <span className="choice-title">{c.name}</span>
                <span className="meta">{c.phone}</span>
              </span>
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="contact" checked={isNew} onChange={() => setContactId("new")} />
            <span className="choice-text">
              <span className="choice-title">New contact</span>
              <span className="meta">Who’s collecting this order</span>
            </span>
          </label>
          {isNew ? (
            <div className="field-row">
              <Field id="name" label="Name" help="The person collecting the order." error={touched.name ? nameError : null}>
                <input
                  id="name"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  autoComplete="name"
                  required
                  aria-invalid={touched.name && !!nameError}
                  aria-describedby={describe("name", touched.name ? nameError : null)}
                />
              </Field>
              <Field id="phone" label="Phone" help="So the shop can reach you about this pickup." error={touched.phone ? phoneError : null}>
                <input
                  id="phone"
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  aria-invalid={touched.phone && !!phoneError}
                  aria-describedby={describe("phone", touched.phone ? phoneError : null)}
                />
              </Field>
            </div>
          ) : null}
        </fieldset>
        <fieldset className="fieldset">
          <legend>Payment</legend>
          {methods.length === 0 ? (
            <p className="notice">
              <Icon name="alert" />
              <span>No payment methods available.</span>
            </p>
          ) : null}
          {methods.map((m) => (
            <label key={m.methodCode} className="choice">
              <input type="radio" name="method" checked={method === m.methodCode} onChange={() => setMethod(m.methodCode)} />
              <span className="choice-title">{m.displayName}</span>
            </label>
          ))}
        </fieldset>
      </form>
      <aside className="summary" aria-label="Order summary">
        <h2 className="summary-title">Order summary</h2>
        {cart.shopGroups.flatMap((g) => g.items).filter((i) => i.itemStatus === "AVAILABLE").map((i) => (
          <div key={i.cartItemId} className="summary-row">
            <span className="meta">{i.title} × {i.quantity}</span>
            <span>{money(i.lineSubtotal, quote?.currency)}</span>
          </div>
        ))}
        {quote?.discountAmount ? (
          <div className="summary-row">
            <span className="meta">Discount</span>
            <span>−{money(quote.discountAmount, quote.currency)}</span>
          </div>
        ) : null}
        <div className="summary-row summary-total">
          <span>Total</span>
          <span>
            {quote ? (
              money(quote.payableAmount, quote.currency)
            ) : (
              <>
                <span className="skeleton sk-inline" aria-hidden="true" />
                <span className="sr-only">Calculating…</span>
              </>
            )}
          </span>
        </div>
        {quote && !quote.canCreate ? (
          <p className="notice" data-tone="error">
            <Icon name="alert" />
            <span>
              This order can’t be placed right now. <Link href="/cart" className="link">Review your cart</Link>
            </span>
          </p>
        ) : null}
        {submitError ? (
          <p className="notice" data-tone="error" role="alert">
            <Icon name="alert" />
            <span>Payment didn’t start: {submitError}</span>
          </p>
        ) : null}
        <button type="submit" form="checkout-form" className="btn btn-primary btn-lg btn-block" disabled={busy || !quote?.confirmationHash || !quote.canCreate || !method}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Taking you to payment…
            </>
          ) : (
            "Pay now"
          )}
        </button>
        <p className="summary-note">
          <Icon name="lock" />
          You’ll pay on Ztor’s secure payment page and come straight back here.
        </p>
      </aside>
    </div>
  );
}
