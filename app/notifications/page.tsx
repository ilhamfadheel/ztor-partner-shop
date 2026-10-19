"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gate, SignInPrompt } from "@/components/Gate";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { notificationText } from "@/lib/notifications";
import type { Session } from "@/lib/oidc";
import { errorText, isAuthError, shop, type ShopNotification } from "@/lib/shop";

const PAGE_SIZE = 20;

const ICON: Record<string, IconName> = {
  "order-paid": "check-circle",
  "order-cancel-requested": "alert",
  "order-cancelled": "x-circle",
  "order-picked-up": "package",
  "order-completed": "check",
  "payment-failed": "alert",
};

export default function NotificationsPage() {
  const t = useT();
  const skeleton = <Loading label={t.notifications.loading}><LinesSkeleton rows={3} /></Loading>;
  return (
    <>
      <h1>{t.notifications.title}</h1>
      <Gate title={t.notifications.signInToSee} fallback={skeleton}>{(session) => <Notifications session={session} />}</Gate>
    </>
  );
}

/** Newest first; opening one marks it read, and "Mark all as read" clears the bell. */
function Notifications({ session }: { session: Session }) {
  const t = useT();
  const skeleton = <Loading label={t.notifications.loading}><LinesSkeleton rows={3} /></Loading>;
  const token = session.accessToken;
  const [items, setItems] = useState<ShopNotification[] | null>(null);
  const [more, setMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    (page: number) =>
      shop
        .notifications(token, page, PAGE_SIZE)
        .then((p) => {
          setItems((prev) => (page === 1 ? p.items : [...(prev ?? []), ...p.items]));
          setMore(p.pageNum < p.pages);
          setUnread(p.unread);
          setPageNum(page);
        })
        .catch(setError),
    [token],
  );
  useEffect(() => void load(1), [load]);

  const settled = (left: number, ids?: string[]) => {
    setUnread(left);
    setItems((prev) => prev?.map((n) => (!ids || ids.includes(n.notificationId) ? { ...n, readAt: n.readAt ?? Date.now() } : n)) ?? null);
    window.dispatchEvent(new Event("ztor-notifications")); // the header's bell
  };
  const open = (n: ShopNotification) => {
    if (!n.readAt) void shop.readNotifications(token, [n.notificationId]).then((r) => settled(r.unread, [n.notificationId]), () => {});
  };
  const readAll = () => void shop.readAllNotifications(token).then((r) => settled(r.unread), setError);

  if (error)
    return isAuthError(error) ? (
      <SignInPrompt title={t.notifications.signInAgainToSee} />
    ) : (
      <StateMessage tone="error" title={t.notifications.couldntLoad} actions={<a href="/notifications" className="btn btn-primary"><Icon name="refresh" />{t.common.tryAgain}</a>}>
        <p className="state-detail">{errorText(error)}</p>
      </StateMessage>
    );
  if (!items) return skeleton;
  if (items.length === 0)
    return (
      <StateMessage icon="bell" title={t.notifications.none} actions={<Link href="/" className="btn btn-primary">{t.notifications.browse}</Link>}>
        <p>{t.notifications.noneBody}</p>
      </StateMessage>
    );
  return (
    <>
      <div className="notes-bar">
        <p className="meta" role="status">{unread ? t.notifications.unreadCount(unread) : t.notifications.allCaughtUp}</p>
        {unread ? <button type="button" className="btn btn-ghost" onClick={readAll}>{t.notifications.markAllRead}</button> : null}
      </div>
      <ul className="lines" role="list">
        {items.map((n) => {
          const { title, detail, href } = notificationText(n, t);
          return (
            <li key={n.notificationId}>
              <Link href={href} className="line line-link note" data-unread={n.readAt ? undefined : ""} onClick={() => open(n)}>
                <span className="note-icon"><Icon name={ICON[n.event] ?? "bell"} /></span>
                <span className="line-meta">
                  <span className="line-title">
                    {title}
                    {n.readAt ? null : <span className="sr-only">{t.notifications.unreadSr}</span>}
                  </span>
                  <span className="note-detail">{detail}</span>
                  <span className="meta">{new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className="line-end">
                  {n.readAt ? null : <span className="note-dot" aria-hidden="true" />}
                  <Icon name="chevron-right" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more ? (
        <p className="notes-more">
          <button type="button" className="btn" onClick={() => void load(pageNum + 1)}>{t.notifications.showOlder}</button>
        </p>
      ) : null}
    </>
  );
}
