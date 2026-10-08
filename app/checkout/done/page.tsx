"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { errorText, isFinal, money, shop, type PaymentResult } from "@/lib/shop";

const PENDING_GROUP = "ztor_pending_group";
const POLL_MS = 3000;
const POLL_LIMIT = 40; // two minutes, then the fan can refresh or pay again

const checking = <StateMessage live icon="spinner" tone="info" title="Checking your payment…" />;

export default function DonePage() {
  return (
    <>
      <h1>Payment</h1>
      <Gate title="Sign in to check your payment" fallback={checking}>{(session) => <Result session={session} />}</Gate>
    </>
  );
}

/** The payment return URL. The group id was saved before leaving for the payment page; poll its converged result. */
function Result({ session }: { session: Session }) {
  const [groupId] = useState(() => sessionStorage.getItem(PENDING_GROUP));
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () =>
      shop
        .checkoutResult(session.accessToken, groupId)
        .then((r) => {
          setResult(r);
          if (!isFinal(r.groupStatus) && ++tries < POLL_LIMIT) timer = setTimeout(tick, POLL_MS);
          if (r.groupStatus === "SUCCEEDED") sessionStorage.removeItem(PENDING_GROUP);
        })
        .catch(setError);
    tick();
    return () => clearTimeout(timer);
  }, [groupId, session.accessToken]);

  async function payAgain(method: string) {
    if (!groupId) return;
    setBusy(true);
    try {
      const r = await shop.pay(session.accessToken, groupId, method);
      if (r.paymentUrl && /^https:\/\//.test(r.paymentUrl)) location.assign(r.paymentUrl);
      else setResult(r.group);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!groupId)
    return (
      <StateMessage icon="package" title="No payment in progress" actions={<Link href="/orders" className="btn btn-primary">See your orders</Link>}>
        <p>Paid orders from this site are listed under Orders.</p>
      </StateMessage>
    );
  if (error)
    return (
      <StateMessage
        tone="error"
        title="Couldn’t check your payment"
        actions={
          <a href="/checkout/done" className="btn btn-primary">
            <Icon name="refresh" />
            Try again
          </a>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!result) return checking;
  const ok = result.groupStatus === "SUCCEEDED";
  const final = isFinal(result.groupStatus);
  return (
    <StateMessage
      live
      tone={ok ? "success" : final ? "error" : "info"}
      icon={ok ? "check-circle" : final ? "x-circle" : "spinner"}
      title={ok ? "Paid — thank you!" : final ? `Payment ${result.groupStatus.toLowerCase()}.` : "Waiting for the payment to confirm…"}
      actions={
        ok ? (
          <Link href="/orders" className="btn btn-primary">Your orders</Link>
        ) : !final && result.paymentMethods?.length ? (
          result.paymentMethods.map((m) => (
            <button key={m.methodCode} className="btn" disabled={busy} onClick={() => void payAgain(m.methodCode)}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              Pay again with {m.displayName}
            </button>
          ))
        ) : final ? (
          <Link href="/" className="btn">Back to the shop</Link>
        ) : null
      }
    >
      <p className="price">#{result.groupNo} · {money(result.payableAmount, result.currency)}</p>
      <ul className="result-orders" role="list">
        {result.orders.map((o) => (
          <li key={o.orderId}>
            {ok ? <Link href={`/orders/${o.orderId}`} className="link">Order {o.orderNo}</Link> : `Order ${o.orderNo}`} · {money(o.payableAmount, result.currency)} · {o.paymentState.toLowerCase()}
          </li>
        ))}
      </ul>
    </StateMessage>
  );
}
