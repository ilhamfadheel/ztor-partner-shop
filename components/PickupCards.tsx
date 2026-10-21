"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Cover } from "@/components/Cover";
import { Icon } from "@/components/Icon";
import { useLang, useT } from "@/components/LangProvider";
import { htmlLang } from "@/lib/i18n";
import { coverImage } from "@/lib/media";
import { cancelledCards, groupBySession, pickupCards, sessionWindow, type PickupCard } from "@/lib/pickup";
import type { Order } from "@/lib/shop";

/**
 * The order's pickup cards (Ztor's own "My orders" layout): one card per piece under a heading per
 * pickup session; the product's picture, its name, where / when / notes, who collects it; the QR
 * and its pickup code on the right while the piece can still be collected; the piece's state last.
 * Tapping the QR enlarges it, with a PNG download for the phone's photos.
 */
export function PickupCards({ order }: { order: Order }) {
  const t = useT();
  const locale = htmlLang(useLang());
  const [zoom, setZoom] = useState<PickupCard | null>(null);
  const cards = pickupCards(order);
  const gone = cancelledCards(order);
  if (!cards.length && !gone.length) return null;

  const contact = order.pickupContact;
  const phone = [contact?.phoneCode?.trim(), contact?.phoneNumber?.trim()].filter(Boolean).join(" ");
  const nameOf = (c: { title: string | null; specification: string | null; piece?: string | null }) =>
    `${c.title ?? t.order.item}${c.specification ? `（${c.specification}）` : ""}${c.piece ? ` ${c.piece}` : ""}`;
  const stamp = (ms: number) => new Date(ms).toLocaleString(locale, { hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="pickup" aria-label={t.order.pickup.heading}>
      {groupBySession(cards).map((group) => (
        <div key={group.session?.sessionId ?? "none"} className="pickup-group">
          <h2 className="pickup-group-title">{group.session?.name?.trim() || t.order.pickup.noSession}</h2>
          {group.cards.map((card) => {
            const where = group.session?.location?.trim();
            const when = group.session ? sessionWindow(group.session, locale) : null;
            const state = (
              <p className="pickup-state">
                <span className="status-chip" data-state={card.qrContent ? "PENDING" : card.status}>{t.order.pickup.state[card.qrContent ? "PENDING" : card.status]}</span>
                {card.receivedAt ? <span className="meta">{stamp(card.receivedAt)}</span> : null}
              </p>
            );
            return (
              <article key={card.key} className="pickup-card" data-status={card.status}>
                <Cover className="pickup-thumb" src={coverImage(card.coverUrl)} alt="" width={56} height={84} loading="lazy" decoding="async" />
                <div className="pickup-body">
                  <h3 className="pickup-title">{t.order.pickup.title(nameOf(card))}</h3>
                  <div className="pickup-lines">
                    {where || when || card.instruction ? (
                      <dl className="pickup-facts">
                        {where ? <div><dt>{t.order.pickup.location}</dt><dd>{where}</dd></div> : null}
                        {when ? <div><dt>{t.order.pickup.window}</dt><dd>{when}</dd></div> : null}
                        {card.instruction ? <div><dt>{t.order.pickup.notes}</dt><dd>{card.instruction}</dd></div> : null}
                      </dl>
                    ) : null}
                    {contact?.name?.trim() || phone ? (
                      <dl className="pickup-facts">
                        {contact?.name?.trim() ? <div><dt>{t.order.pickup.person}</dt><dd>{contact.name.trim()}</dd></div> : null}
                        {phone ? <div><dt>{t.order.pickup.phone}</dt><dd>{phone}</dd></div> : null}
                      </dl>
                    ) : null}
                  </div>
                  <p className="meta pickup-note">{t.order.pickup.note}</p>
                  <div className="pickup-state-main">{state}</div>
                </div>
                {card.qrContent ? (
                  <div className="pickup-side">
                    <button type="button" className="pickup-qr" aria-label={t.order.pickup.zoom} onClick={() => setZoom(card)}>
                      <QRCodeSVG value={card.qrContent} size={96} marginSize={0} />
                    </button>
                    {card.pickupCode ? <span className="pickup-code" aria-label={t.order.pickup.code}>{card.pickupCode}</span> : null}
                    <div className="pickup-state-side">{state}</div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ))}
      {gone.map((card) => (
        <article key={card.key} className="pickup-card" data-status="CANCELLED">
          <Cover className="pickup-thumb" src={coverImage(card.coverUrl)} alt="" width={56} height={84} loading="lazy" decoding="async" />
          <div className="pickup-body">
            <h3 className="pickup-title">{t.order.pickup.cancelled(`${nameOf(card)}${card.quantity > 1 ? ` × ${card.quantity}` : ""}`)}</h3>
            {card.cancelledAt ? <p className="meta">{t.order.pickup.cancelledOn(stamp(card.cancelledAt))}</p> : null}
            {card.reason ? <p className="meta">{t.order.pickup.cancelReason(card.reason)}</p> : null}
          </div>
        </article>
      ))}
      {zoom?.qrContent ? <QrZoom card={zoom} name={nameOf(zoom)} orderNo={order.orderNo} onClose={() => setZoom(null)} /> : null}
    </section>
  );
}

function QrZoom({ card, name, orderNo, onClose }: { card: PickupCard; name: string; orderNo: string; onClose: () => void }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const download = () => {
    try {
      const a = document.createElement("a");
      a.href = canvas.current!.toDataURL("image/png");
      a.download = `pickup-${card.pickupCode ?? `${orderNo}-${card.key.split(":")[1] ?? "1"}`}.png`.replace(/[^\w.-]+/g, "-");
      a.click();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  return (
    <dialog ref={dialog} className="pickup-zoom" onClose={onClose} aria-labelledby="pickup-zoom-title">
      <button type="button" className="btn pickup-zoom-close" aria-label={t.order.pickup.close} onClick={() => dialog.current?.close()}>
        <Icon name="x" />
      </button>
      <h2 id="pickup-zoom-title" className="pickup-zoom-title">{t.order.pickup.title(name)}</h2>
      <div className="pickup-zoom-qr">
        <QRCodeSVG value={card.qrContent!} size={240} marginSize={2} />
      </div>
      {card.pickupCode ? (
        <p className="pickup-zoom-code">
          <span className="meta">{t.order.pickup.code}</span> <strong>{card.pickupCode}</strong>
        </p>
      ) : null}
      <p className="meta">{t.order.pickup.zoomHelp}</p>
      {/* the PNG is drawn from its own canvas at print size, off-screen */}
      <QRCodeCanvas ref={canvas} value={card.qrContent!} size={720} marginSize={4} style={{ display: "none" }} />
      <button type="button" className="btn btn-primary btn-block" onClick={download}>
        <Icon name="download" />
        {t.order.pickup.download}
      </button>
      {failed ? <p className="notice" data-tone="error" role="alert">{t.order.pickup.downloadFailed}</p> : null}
    </dialog>
  );
}
