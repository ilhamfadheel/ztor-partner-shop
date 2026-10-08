import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { GridSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { missingConfig } from "@/lib/config";
import { errorText, money, shop, type ProductCard } from "@/lib/shop";

export default function Home() {
  const missing = missingConfig();
  if (missing.length)
    return (
      <StateMessage tone="error" heading="h1" title="This shop isn’t configured">
        <p className="state-detail">Set {missing.join(", ")}.</p>
      </StateMessage>
    );
  return (
    <>
      <h1>Shop</h1>
      <Suspense fallback={<Loading label="Loading products…"><GridSkeleton /></Loading>}>
        <Catalogue />
      </Suspense>
    </>
  );
}

/** Streams in after the heading; the grid skeleton holds the same boxes meanwhile. */
async function Catalogue() {
  const lang = (await headers()).get("accept-language") ?? undefined;
  let page: { items: ProductCard[]; total: number } | undefined;
  let error: string | undefined;
  try {
    page = await shop.products(1, 48, lang);
  } catch (e) {
    error = errorText(e);
  }
  if (error)
    return (
      <StateMessage
        tone="error"
        title="Couldn’t load the shop"
        actions={
          // A plain link = a fresh request, so retry works before (or without) JavaScript.
          <a href="/" className="btn btn-primary">
            <Icon name="refresh" />
            Try again
          </a>
        }
      >
        <p>The shop didn’t answer. Give it a moment and try again.</p>
        <p className="state-detail">{error}</p>
      </StateMessage>
    );
  if (!page || page.items.length === 0)
    return (
      <StateMessage icon="bag" title="No products yet">
        <p>Check back soon.</p>
      </StateMessage>
    );
  return (
    <ul className="grid" role="list">
      {page.items.map((p, i) => (
        <li key={p.productId}>
          <Link href={`/products/${p.productId}`} className="card">
            <img className="card-media" src={p.coverUrl} alt="" width={400} height={400} loading={i < 4 ? "eager" : "lazy"} decoding="async" />
            <div className="card-body">
              <span className="card-title">{p.title}</span>
              <span className="price">{p.minPrice === p.maxPrice ? money(p.minPrice, p.currency) : `${money(p.minPrice, p.currency)} – ${money(p.maxPrice, p.currency)}`}</span>
              <span className="meta cap">{!p.sellable ? p.availabilityStatus.replaceAll("_", " ").toLowerCase() : p.newProduct ? "New" : p.limited ? "Limited" : p.mainCategoryName ?? ""}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
