"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { Cover } from "@/components/Cover";
import { coverImage } from "@/lib/media";
import { errorText, money, orderStatusLabel, shop, type Order } from "@/lib/shop";

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const skeleton = <Loading label={t.order.loading}><LinesSkeleton rows={1} summary /></Loading>;
  const { id } = use(params);
  return (
    <>
      <Link href="/orders" className="back-link">
        <Icon name="chevron-left" />
        {t.order.allOrders}
      </Link>
      <h1>{t.order.title}</h1>
      <Gate title={t.order.signInToSee} fallback={skeleton}>{(session) => <OrderView session={session} id={id} />}</Gate>
    </>
  );
}

function OrderView({ session, id }: { session: Session; id: string }) {
  const t = useT();
  const skeleton = <Loading label={t.order.loading}><LinesSkeleton rows={1} summary /></Loading>;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.order(session.accessToken, id).then(setOrder).catch(setError);
  }, [session.accessToken, id]);
  if (error)
    return (
      <StateMessage
        tone="error"
        title={t.order.couldntLoad}
        actions={
          <>
            <a href={`/orders/${encodeURIComponent(id)}`} className="btn btn-primary">
              <Icon name="refresh" />
              {t.common.tryAgain}
            </a>
            <Link href="/orders" className="btn">{t.order.allOrders}</Link>
          </>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!order) return skeleton;
  return (
    <div className="stack">
      <p className="meta order-meta">
        <span>#{order.orderNo}</span>
        <span className="status-chip">{orderStatusLabel(order.displayStatus, t.orders.status)}</span>
        {order.paidAt ? <span>{t.order.paidAt(new Date(order.paidAt).toLocaleString())}</span> : null}
      </p>
      <div className="with-summary">
        <ul className="lines" role="list">
          {order.items.map((i) => (
            <li key={i.orderItemId} className="line">
              <Cover className="line-thumb" src={coverImage(i.coverUrl)} alt="" width={88} height={88} loading="lazy" decoding="async" />
              <div className="line-meta">
                <span className="line-title">{i.title ?? t.order.item}</span>
                <span className="meta">{[i.specification, `× ${i.quantity}`].filter(Boolean).join(" · ")}</span>
                {i.qrCodes?.length ? <span className="meta">{t.order.pickupQr(i.qrCodes.map((q) => `#${q.seq} ${q.status.toLowerCase()}`).join(", "))}</span> : null}
              </div>
              <span className="price line-end">{money(i.totalAmount, i.currency)}</span>
            </li>
          ))}
        </ul>
        <aside className="summary" aria-label={t.order.summary}>
          {order.pickupContact ? (
            <div className="summary-row">
              <span className="meta">{t.order.pickupContact}</span>
              <span>{order.pickupContact.name} · {order.pickupContact.phoneCode ?? ""}{order.pickupContact.phoneNumber ?? ""}</span>
            </div>
          ) : null}
          <div className="summary-row summary-total">
            <span>{t.order.total}</span>
            <span>{money(order.payableAmount, order.currency)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
