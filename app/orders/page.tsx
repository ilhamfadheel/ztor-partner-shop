"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import type { Session } from "@/lib/oidc";
import { Cover } from "@/components/Cover";
import { coverImage } from "@/lib/media";
import { displayStatusKey, pickupProgressText } from "@/lib/pickup";
import { errorText, isAuthError, money, orderStatusLabel, shop, type OrderGroup } from "@/lib/shop";

export default function OrdersPage() {
  const t = useT();
  const skeleton = <Loading label={t.orders.loading}><LinesSkeleton rows={3} /></Loading>;
  return (
    <>
      <h1>{t.orders.title}</h1>
      <Gate title={t.orders.signInToSee} fallback={skeleton}>{(session) => <Orders session={session} />}</Gate>
    </>
  );
}

function Orders({ session }: { session: Session }) {
  const t = useT();
  const skeleton = <Loading label={t.orders.loading}><LinesSkeleton rows={3} /></Loading>;
  const [groups, setGroups] = useState<OrderGroup[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    shop.orders(session.accessToken).then((p) => setGroups(p.items)).catch(setError);
  }, [session.accessToken]);
  if (error)
    return isAuthError(error) ? (
      <SignInPrompt title={t.common.signInAgain} text={t.common.signInNotCover} />
    ) : (
      <StateMessage
        tone="error"
        title={t.orders.couldntLoad}
        actions={
          <a href="/orders" className="btn btn-primary">
            <Icon name="refresh" />
            {t.common.tryAgain}
          </a>
        }
      >
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!groups) return skeleton;
  if (groups.length === 0)
    return (
      <StateMessage icon="package" title={t.orders.none} actions={<a href="/shop" className="btn btn-primary">{t.cart.browse}</a>}>
        <p>{t.orders.noneBody}</p>
      </StateMessage>
    );
  return (
    <ul className="lines" role="list">
      {groups.flatMap((g) =>
        g.orders.map((o) => (
          <li key={o.orderId}>
            <Link href={`/orders/${o.orderId}`} className="line line-link">
              <Cover className="line-thumb" src={coverImage(o.items[0]?.coverUrl)} alt="" width={88} height={88} loading="lazy" decoding="async" />
              <span className="line-meta">
                <span className="line-title">{o.items.map((i) => i.title).filter(Boolean).join(", ") || t.orders.order(o.orderNo ?? "")}</span>
                <span className="meta">#{o.orderNo} · {new Date(g.createdAt).toLocaleDateString()}</span>
                <span className="order-status">
                  <span className="status-chip">{orderStatusLabel(displayStatusKey(o), t.orders.status)}</span>
                  {pickupProgressText(o, t.orders.progress) ? <span className="meta">{pickupProgressText(o, t.orders.progress)}</span> : null}
                </span>
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
