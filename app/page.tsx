import Link from "next/link";
import { headers } from "next/headers";
import { missingConfig } from "@/lib/config";
import { errorText, money, shop, type ProductCard } from "@/lib/shop";

export default async function Home() {
  const missing = missingConfig();
  if (missing.length) return <p className="notice error">Not configured: set {missing.join(", ")}.</p>;
  const lang = (await headers()).get("accept-language") ?? undefined;
  let page: { items: ProductCard[]; total: number } | undefined;
  let error: string | undefined;
  try {
    page = await shop.products(1, 48, lang);
  } catch (e) {
    error = errorText(e);
  }
  return (
    <>
      <h1>Shop</h1>
      {error ? <p className="notice error">Couldn’t load the shop: {error}</p> : null}
      {page && page.items.length === 0 ? <p className="notice">No products yet — check back soon.</p> : null}
      {page ? (
        <div className="grid">
          {page.items.map((p) => (
            <Link key={p.productId} href={`/products/${p.productId}`} className="card">
              <img src={p.coverUrl} alt="" loading="lazy" />
              <div className="body">
                <span className="title">{p.title}</span>
                <span className="price">{p.minPrice === p.maxPrice ? money(p.minPrice, p.currency) : `${money(p.minPrice, p.currency)} – ${money(p.maxPrice, p.currency)}`}</span>
                <span className="tag">{!p.sellable ? p.availabilityStatus.replaceAll("_", " ").toLowerCase() : p.newProduct ? "New" : p.limited ? "Limited" : p.mainCategoryName ?? ""}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
