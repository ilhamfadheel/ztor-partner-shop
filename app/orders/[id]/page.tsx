"use client";
import { use, useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import type { Session } from "@/lib/oidc";
import { errorText, money, shop, type Order } from "@/lib/shop";

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <h1>Order</h1>
      <Gate>{(session) => <OrderView session={session} id={id} />}</Gate>
    </>
  );
}

function OrderView({ session, id }: { session: Session; id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.order(session.accessToken, id).then(setOrder).catch(setError);
  }, [session.accessToken, id]);
  if (error) return <p className="notice error">{errorText(error)}</p>;
  if (!order) return <p className="muted">Loading…</p>;
  return (
    <>
      <p className="tag">#{order.orderNo} · {order.displayStatus.toLowerCase()}{order.paidAt ? ` · paid ${new Date(order.paidAt).toLocaleString()}` : ""}</p>
      <div className="lines">
        {order.items.map((i) => (
          <div key={i.orderItemId} className="line">
            {i.coverUrl ? <img src={i.coverUrl} alt="" /> : <div />}
            <div className="meta">
              <span className="title">{i.title ?? "Item"}</span>
              <span className="tag">{i.specification} · × {i.quantity}</span>
              {i.qrCodes?.length ? <span className="tag">Pickup QR: {i.qrCodes.map((q) => `#${q.seq} ${q.status.toLowerCase()}`).join(", ")}</span> : null}
            </div>
            <span className="price">{money(i.totalAmount, i.currency)}</span>
          </div>
        ))}
      </div>
      <div className="summary">
        {order.pickupContact ? <div className="row"><span className="muted">Pickup contact</span><span>{order.pickupContact.name} · {order.pickupContact.phoneCode ?? ""}{order.pickupContact.phoneNumber ?? ""}</span></div> : null}
        <div className="row total"><span>Total</span><span>{money(order.payableAmount, order.currency)}</span></div>
      </div>
    </>
  );
}
