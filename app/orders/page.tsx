"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, money, shop, type OrderGroup } from "@/lib/shop";

const skeleton = <Loading label="Loading your orders…"><LinesSkeleton rows={3} /></Loading>;

export default function OrdersPage() {
  return (
    <>
      <h1>Orders</h1>
      <Gate title="Sign in to see your orders" fallback={skeleton}>{(session) => <Orders session={session} />}</Gate>
    </>
  );
}

function Orders({ session }: { session: Session }) {
  const [groups, setGroups] = useState<OrderGroup[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.orders(session.accessToken).then((p) => setGroups(p.items)).catch(setError);
  }, [session.accessToken]);
  if (error)
    return isAuthError(error) ? (
      <SignInPrompt title="Sign in again" text="Your Ztor sign-in doesn’t cover this shop yet." />
    ) : (
      <StateMessage
        tone="error"
        title="Couldn’t load your orders"
        actions={
          <a href="/orders" className="btn btn-primary">
            <Icon name="refresh" />
            Try again
          </a>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!groups) return skeleton;
  if (groups.length === 0)
    return (
      <StateMessage icon="package" title="No orders yet" actions={<Link href="/" className="btn btn-primary">Browse the shop</Link>}>
        <p>Orders you pay for on this site show up here.</p>
      </StateMessage>
    );
  return (
    <ul className="lines" role="list">
      {groups.flatMap((g) =>
        g.orders.map((o) => (
          <li key={o.orderId}>
            <Link href={`/orders/${o.orderId}`} className="line line-link">
              {o.items[0]?.coverUrl ? <img className="line-thumb" src={o.items[0].coverUrl} alt="" width={88} height={88} loading="lazy" decoding="async" /> : <span className="line-thumb" aria-hidden="true" />}
              <span className="line-meta">
                <span className="line-title">{o.items.map((i) => i.title).filter(Boolean).join(", ") || `Order ${o.orderNo}`}</span>
                <span className="meta">#{o.orderNo} · {new Date(g.createdAt).toLocaleDateString()}</span>
                <span className="status-chip">{o.displayStatus.toLowerCase()}</span>
              </span>
              <span className="line-end">
                <span className="price">{money(o.payableAmount, o.currency)}</span>
                <Icon name="chevron-right" />
              </span>
            </Link>
          </li>
        )),
      )}
    </ul>
  );
}
