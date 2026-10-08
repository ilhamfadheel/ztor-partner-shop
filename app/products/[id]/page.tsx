import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
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
  let product: Awaited<ReturnType<typeof load>>;
  try {
    product = await load((await params).id);
  } catch (e) {
    return <p className="notice error">Couldn’t load this product: {errorText(e)}</p>;
  }
  const images = product.media.filter((m) => m.type === "IMAGE").sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="product">
      <div className="gallery">
        {images[0] ? <img src={images[0].url} alt={product.title} /> : null}
        {images.length > 1 ? (
          <div className="thumbs">
            {images.slice(1, 6).map((m) => (
              <img key={m.url} src={m.url} alt="" />
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <h1 style={{ marginBottom: 8 }}>{product.title}</h1>
        <p className="price" style={{ fontSize: 20, margin: "0 0 4px" }}>
          {product.minPrice === product.maxPrice ? money(product.minPrice, product.currency) : `${money(product.minPrice, product.currency)} – ${money(product.maxPrice, product.currency)}`}
        </p>
        <p className="tag">{product.fulfillmentType === "QR_PICKUP" && product.pickup ? `Pickup · ${product.pickup.name}, ${product.pickup.location}` : product.fulfillmentType === "SHIPPING" ? "Ships to you" : ""}</p>
        <AddToCart product={product} />
        {product.description ? (
          <>
            <h2>About</h2>
            <p className="prose">{product.description}</p>
          </>
        ) : null}
        {product.attributes?.length ? (
          <dl className="muted">
            {product.attributes.map((a) => (
              <div key={a.name} style={{ display: "flex", gap: 8 }}>
                <dt>{a.name}:</dt>
                <dd style={{ margin: 0 }}>{a.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
