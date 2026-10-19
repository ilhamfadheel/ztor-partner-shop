"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { CheckoutSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { preferredPayment } from "@/lib/preferences";
import { errorText, isAuthError, money, shop, type Cart, type PaymentMethod, type PickupContact, type Quote } from "@/lib/shop";

export const PENDING_GROUP = "ztor_pending_group";

export default function CheckoutPage() {
  const t = useT();
  const skeleton = <Loading label={t.checkout.loading}><CheckoutSkeleton /></Loading>;
  return (
    <>
      <h1>{t.checkout.title}</h1>
      <Gate title={t.checkout.signInToCheckout} fallback={skeleton}>{(session) => <Checkout session={session} />}</Gate>
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
  const t = useT();
  const skeleton = <Loading label={t.checkout.loading}><CheckoutSkeleton /></Loading>;
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
    shop.paymentMethods(token).then((m) => { setMethods(m); const preferred = preferredPayment(); setMethod((m.find((x) => x.methodCode === preferred) ?? m[0])?.methodCode ?? ""); }).catch(setError);
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
      <SignInPrompt title={t.common.signInAgain} text={t.common.signInNotCover} />
    ) : (
      <StateMessage
        tone="error"
        title={t.checkout.couldntLoad}
        actions={
          <>
            <a href="/checkout" className="btn btn-primary">
              <Icon name="refresh" />
              {t.common.tryAgain}
            </a>
            <Link href="/cart" className="btn">{t.checkout.backToCart}</Link>
          </>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!cart) return skeleton;
  if (lineIds.length === 0)
    return (
      <StateMessage icon="bag" title={t.checkout.nothingToPay} actions={<Link href="/cart" className="btn btn-primary">{t.checkout.backToCart}</Link>}>
        <p>{t.checkout.noAvailableItems}</p>
      </StateMessage>
    );

  const isNew = contactId === "new";
  const nameError = isNew && !contact.name.trim() ? t.checkout.nameError : null;
  const phoneError = isNew && !contact.phone.trim() ? t.checkout.phoneError : null;
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
          <legend>{t.checkout.pickupContact}</legend>
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
              <span className="choice-title">{t.checkout.newContact}</span>
              <span className="meta">{t.checkout.whoCollects}</span>
            </span>
          </label>
          {isNew ? (
            <div className="field-row">
              <Field id="name" label={t.checkout.name} help={t.checkout.nameHelp} error={touched.name ? nameError : null}>
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
              <Field id="phone" label={t.checkout.phone} help={t.checkout.phoneHelp} error={touched.phone ? phoneError : null}>
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
          <legend>{t.checkout.payment}</legend>
          {methods.length === 0 ? (
            <p className="notice">
              <Icon name="alert" />
              <span>{t.checkout.noMethods}</span>
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
      <aside className="summary" aria-label={t.checkout.summary}>
        <h2 className="summary-title">{t.checkout.summary}</h2>
        {cart.shopGroups.flatMap((g) => g.items).filter((i) => i.itemStatus === "AVAILABLE").map((i) => (
          <div key={i.cartItemId} className="summary-row">
            <span className="meta">{i.title} × {i.quantity}</span>
            <span>{money(i.lineSubtotal, quote?.currency)}</span>
          </div>
        ))}
        {quote?.discountAmount ? (
          <div className="summary-row">
            <span className="meta">{t.checkout.discount}</span>
            <span>−{money(quote.discountAmount, quote.currency)}</span>
          </div>
        ) : null}
        <div className="summary-row summary-total">
          <span>{t.checkout.total}</span>
          <span>
            {quote ? (
              money(quote.payableAmount, quote.currency)
            ) : (
              <>
                <span className="skeleton sk-inline" aria-hidden="true" />
                <span className="sr-only">{t.checkout.calculating}</span>
              </>
            )}
          </span>
        </div>
        {quote && !quote.canCreate ? (
          <p className="notice" data-tone="error">
            <Icon name="alert" />
            <span>
              {t.checkout.cantPlace} <Link href="/cart" className="link">{t.checkout.reviewCart}</Link>
            </span>
          </p>
        ) : null}
        {submitError ? (
          <p className="notice" data-tone="error" role="alert">
            <Icon name="alert" />
            <span>{t.checkout.didntStart(submitError)}</span>
          </p>
        ) : null}
        <button type="submit" form="checkout-form" className="btn btn-primary btn-lg btn-block" disabled={busy || !quote?.confirmationHash || !quote.canCreate || !method}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.checkout.takingToPayment}
            </>
          ) : (
            t.checkout.payNow
          )}
        </button>
        <p className="summary-note">
          <Icon name="lock" />
          {t.checkout.securePage}
        </p>
      </aside>
    </div>
  );
}
