"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import type { Session } from "@/lib/oidc";
import { errorText, isFinal, money, shop, type PaymentResult } from "@/lib/shop";

const PENDING_GROUP = "ztor_pending_group";
const POLL_MS = 3000;
const POLL_LIMIT = 40; // two minutes, then the fan can refresh or pay again

export default function DonePage() {
  return (
    <>
      <h1>Payment</h1>
      <Gate>{(session) => <Result session={session} />}</Gate>
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

  if (!groupId) return <p className="notice">No payment in progress. <Link href="/orders" style={{ textDecoration: "underline" }}>See your orders</Link></p>;
  if (error) return <p className="notice error">{errorText(error)}</p>;
  if (!result) return <p className="muted">Checking your payment…</p>;
  const ok = result.groupStatus === "SUCCEEDED";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className={`notice ${ok ? "ok" : result.groupStatus === "CANCELED" || result.groupStatus === "EXPIRED" ? "error" : ""}`}>
        {ok ? "Paid — thank you!" : isFinal(result.groupStatus) ? `Payment ${result.groupStatus.toLowerCase()}.` : "Waiting for the payment to confirm…"}
        <span className="tag" style={{ marginLeft: 8 }}>#{result.groupNo} · {money(result.payableAmount, result.currency)}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {result.orders.map((o) => (
          <li key={o.orderId}>
            {ok ? <Link href={`/orders/${o.orderId}`} style={{ textDecoration: "underline" }}>Order {o.orderNo}</Link> : `Order ${o.orderNo}`} · {money(o.payableAmount, result.currency)} · {o.paymentState.toLowerCase()}
          </li>
        ))}
      </ul>
      {!ok && isFinal(result.groupStatus) === false && result.paymentMethods?.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {result.paymentMethods.map((m) => (
            <button key={m.methodCode} className="btn" disabled={busy} onClick={() => void payAgain(m.methodCode)}>Pay again with {m.displayName}</button>
          ))}
        </div>
      ) : null}
      {ok ? <Link href="/orders" className="btn" style={{ justifySelf: "start" }}>Your orders</Link> : null}
    </div>
  );
}
