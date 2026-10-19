"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { errorText, isFinal, money, shop, type PaymentResult } from "@/lib/shop";

const PENDING_GROUP = "ztor_pending_group";
const POLL_MS = 3000;
const POLL_LIMIT = 40; // two minutes, then the fan can refresh or pay again

export default function DonePage() {
  const t = useT();
  const checking = <StateMessage live icon="spinner" tone="info" title={t.done.checking} />;
  return (
    <>
      <h1>{t.done.title}</h1>
      <Gate title={t.done.signInToCheck} fallback={checking}>{(session) => <Result session={session} />}</Gate>
    </>
  );
}

/** The payment return URL. The group id was saved before leaving for the payment page; poll its converged result. */
function Result({ session }: { session: Session }) {
  const t = useT();
  const checking = <StateMessage live icon="spinner" tone="info" title={t.done.checking} />;
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
      <StateMessage icon="package" title={t.done.noPayment} actions={<Link href="/orders" className="btn btn-primary">{t.done.seeOrders}</Link>}>
        <p>{t.done.paidListed}</p>
      </StateMessage>
    );
  if (error)
    return (
      <StateMessage
        tone="error"
        title={t.done.couldntCheck}
        actions={
          <a href="/checkout/done" className="btn btn-primary">
            <Icon name="refresh" />
            {t.common.tryAgain}
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
      title={ok ? t.done.paidThanks : final ? t.done.paymentStatus(result.groupStatus.toLowerCase()) : t.done.waiting}
      actions={
        ok ? (
          <Link href="/orders" className="btn btn-primary">{t.done.yourOrders}</Link>
        ) : !final && result.paymentMethods?.length ? (
          result.paymentMethods.map((m) => (
            <button key={m.methodCode} className="btn" disabled={busy} onClick={() => void payAgain(m.methodCode)}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {t.done.payAgainWith(m.displayName)}
            </button>
          ))
        ) : final ? (
          <Link href="/" className="btn">{t.common.backToShop}</Link>
        ) : null
      }
    >
      <p className="price">#{result.groupNo} · {money(result.payableAmount, result.currency)}</p>
      <ul className="result-orders" role="list">
        {result.orders.map((o) => (
          <li key={o.orderId}>
            {ok ? <Link href={`/orders/${o.orderId}`} className="link">{t.done.order(o.orderNo)}</Link> : t.done.order(o.orderNo)} · {money(o.payableAmount, result.currency)} · {o.paymentState.toLowerCase()}
          </li>
        ))}
      </ul>
    </StateMessage>
  );
}
