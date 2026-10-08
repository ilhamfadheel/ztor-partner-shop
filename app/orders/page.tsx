"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type OrderGroup } from "@/lib/shop";

export default function OrdersPage() {
  return (
    <>
      <h1>Orders</h1>
      <Gate>{(session) => <Orders session={session} />}</Gate>
    </>
  );
}

function Orders({ session }: { session: Session }) {
  const [groups, setGroups] = useState<OrderGroup[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.orders(session.accessToken).then((p) => setGroups(p.items)).catch(setError);
  }, [session.accessToken]);
  if (error) return isAuthError(error) ? <SignInPrompt text="Your Ztor sign-in doesn’t cover this shop yet — sign in again." /> : <p className="notice error">{errorText(error)}</p>;
  if (!groups) return <p className="muted">Loading…</p>;
  if (groups.length === 0) return <p className="notice">No orders yet.</p>;
  return (
    <div className="lines">
      {groups.flatMap((g) =>
        g.orders.map((o) => (
          <Link key={o.orderId} href={`/orders/${o.orderId}`} className="line" style={{ gridTemplateColumns: "72px 1fr auto" }}>
            {o.items[0]?.coverUrl ? <img src={o.items[0].coverUrl} alt="" /> : <div />}
            <div className="meta">
              <span className="title">{o.items.map((i) => i.title).filter(Boolean).join(", ") || `Order ${o.orderNo}`}</span>
              <span className="tag">#{o.orderNo} · {new Date(g.createdAt).toLocaleDateString()} · {o.displayStatus.toLowerCase()}</span>
            </div>
            <span className="price">{money(o.payableAmount, o.currency)}</span>
          </Link>
        )),
      )}
    </div>
  );
}
