import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { Gallery } from "@/components/Gallery";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import { dict, type Messages } from "@/lib/i18n";
import { resolveLang } from "@/lib/lang";
import { galleryItems } from "@/lib/media";
import { ShopError, errorText, money, shop, type PickupSession } from "@/lib/shop";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const lang = await resolveLang();
  try {
    return await shop.product(id, lang);
  } catch (e) {
    if (e instanceof ShopError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const p = await load((await params).id);
    return { title: p.title, description: p.description?.slice(0, 160) ?? undefined };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const t = dict(await resolveLang());
  let product: Awaited<ReturnType<typeof load>>;
  try {
    product = await load(id);
  } catch (e) {
    return (
      <StateMessage
        tone="error"
        heading="h1"
        title={t.product.couldntLoad}
        actions={
          <>
            <a href={`/products/${encodeURIComponent(id)}`} className="btn btn-primary">
              <Icon name="refresh" />
              {t.common.tryAgain}
            </a>
            <Link href="/" className="btn">{t.common.backToShop}</Link>
          </>
        }
      >
        <p>{t.home.noAnswer}</p>
        <p className="state-detail">{errorText(e)}</p>
      </StateMessage>
    );
  }
  const gallery = galleryItems(product.media);
  const fulfilment =
    product.fulfillmentType === "QR_PICKUP" ? pickupLine(product.pickup?.sessions ?? [], t) : product.fulfillmentType === "SHIPPING" ? { icon: "truck" as const, text: t.product.shipsToYou } : null;
  return (
    <>
      <Link href="/" className="back-link">
        <Icon name="chevron-left" />
        {t.header.shop}
      </Link>
      <div className="product">
        <Gallery items={gallery} title={product.title} />
        <div className="product-info">
          <h1>{product.title}</h1>
          <p className="price product-price">
            {product.minPrice === product.maxPrice ? money(product.minPrice, product.currency) : `${money(product.minPrice, product.currency)} – ${money(product.maxPrice, product.currency)}`}
          </p>
          {fulfilment ? (
            <p className="meta with-icon">
              <Icon name={fulfilment.icon} />
              {fulfilment.text}
            </p>
          ) : null}
          <AddToCart product={product} />
          {product.description ? (
            <section className="product-section">
              <h2>{t.product.about}</h2>
              <p className="prose">{product.description}</p>
            </section>
          ) : null}
          {product.attributes?.length ? (
            <dl className="specs">
              {product.attributes.map((a) => (
                <div key={a.name}>
                  <dt>{a.name}</dt>
                  <dd>{a.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** "Pickup · 台北簽署會場, B區取貨地 (+1 more)": the first session still open (else the first), and how many others there are. */
function pickupLine(sessions: PickupSession[], t: Messages) {
  const shown = sessions.find((x) => x.statusCode !== "ENDED") ?? sessions[0];
  if (!shown) return { icon: "pin" as const, text: t.product.pickupQr };
  const more = sessions.length > 1 ? t.product.pickupMore(sessions.length - 1) : "";
  return { icon: "pin" as const, text: `${t.product.pickupAt([shown.name, shown.location].filter(Boolean).join(", "))}${more}` };
}
