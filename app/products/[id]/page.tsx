import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import { ShopError, errorText, money, shop } from "@/lib/shop";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const lang = (await headers()).get("accept-language") ?? undefined;
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
  let product: Awaited<ReturnType<typeof load>>;
  try {
    product = await load(id);
  } catch (e) {
    return (
      <StateMessage
        tone="error"
        heading="h1"
        title="Couldn’t load this product"
        actions={
          <>
            <a href={`/products/${encodeURIComponent(id)}`} className="btn btn-primary">
              <Icon name="refresh" />
              Try again
            </a>
            <Link href="/" className="btn">Back to the shop</Link>
          </>
        }
      >
        <p>The shop didn’t answer. Give it a moment and try again.</p>
        <p className="state-detail">{errorText(e)}</p>
      </StateMessage>
    );
  }
  const images = product.media.filter((m) => m.type === "IMAGE").sort((a, b) => a.sortOrder - b.sortOrder);
  const fulfilment =
    product.fulfillmentType === "QR_PICKUP" && product.pickup ? { icon: "pin" as const, text: `Pickup · ${product.pickup.name}, ${product.pickup.location}` } : product.fulfillmentType === "SHIPPING" ? { icon: "truck" as const, text: "Ships to you" } : null;
  return (
    <>
      <Link href="/" className="back-link">
        <Icon name="chevron-left" />
        Shop
      </Link>
      <div className="product">
        <div className="gallery">
          {images[0] ? <img className="gallery-main" src={images[0].url} alt={product.title} width={800} height={800} fetchPriority="high" decoding="async" /> : <span className="gallery-main" aria-hidden="true" />}
          {images.length > 1 ? (
            <ul className="thumbs" role="list">
              {images.slice(1, 6).map((m, i) => (
                <li key={m.url}>
                  <img src={m.url} alt={`${product.title}, image ${i + 2}`} width={160} height={160} loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
              <h2>About</h2>
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
