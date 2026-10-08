"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { mediaUrl } from "@/lib/media";
import { errorText, money, shop, type Order } from "@/lib/shop";

const skeleton = <Loading label="Loading this order…"><LinesSkeleton rows={1} summary /></Loading>;

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <Link href="/orders" className="back-link">
        <Icon name="chevron-left" />
        All orders
      </Link>
      <h1>Order</h1>
      <Gate title="Sign in to see this order" fallback={skeleton}>{(session) => <OrderView session={session} id={id} />}</Gate>
    </>
  );
}

function OrderView({ session, id }: { session: Session; id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.order(session.accessToken, id).then(setOrder).catch(setError);
  }, [session.accessToken, id]);
  if (error)
    return (
      <StateMessage
        tone="error"
        title="Couldn’t load this order"
        actions={
          <>
            <a href={`/orders/${encodeURIComponent(id)}`} className="btn btn-primary">
              <Icon name="refresh" />
              Try again
            </a>
            <Link href="/orders" className="btn">All orders</Link>
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
        <span className="status-chip">{order.displayStatus.toLowerCase()}</span>
        {order.paidAt ? <span>Paid {new Date(order.paidAt).toLocaleString()}</span> : null}
      </p>
      <div className="with-summary">
        <ul className="lines" role="list">
          {order.items.map((i) => (
            <li key={i.orderItemId} className="line">
              {mediaUrl(i.coverUrl) ? <img className="line-thumb" src={mediaUrl(i.coverUrl)} alt="" width={88} height={88} loading="lazy" decoding="async" /> : <span className="line-thumb" aria-hidden="true" />}
              <div className="line-meta">
                <span className="line-title">{i.title ?? "Item"}</span>
                <span className="meta">{[i.specification, `× ${i.quantity}`].filter(Boolean).join(" · ")}</span>
                {i.qrCodes?.length ? <span className="meta">Pickup QR: {i.qrCodes.map((q) => `#${q.seq} ${q.status.toLowerCase()}`).join(", ")}</span> : null}
              </div>
              <span className="price line-end">{money(i.totalAmount, i.currency)}</span>
            </li>
          ))}
        </ul>
        <aside className="summary" aria-label="Order summary">
          {order.pickupContact ? (
            <div className="summary-row">
              <span className="meta">Pickup contact</span>
              <span>{order.pickupContact.name} · {order.pickupContact.phoneCode ?? ""}{order.pickupContact.phoneNumber ?? ""}</span>
            </div>
          ) : null}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{money(order.payableAmount, order.currency)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
