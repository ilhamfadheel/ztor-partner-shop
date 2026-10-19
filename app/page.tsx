import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { Icon } from "@/components/Icon";
import { GridSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { missingConfig } from "@/lib/config";
import { isSoldOut } from "@/lib/availability";
import { dict } from "@/lib/i18n";
import { resolveLang } from "@/lib/lang";
import { coverImage, galleryItems, isVideoUrl } from "@/lib/media";
import { errorText, money, shop, type ProductCard } from "@/lib/shop";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const t = dict(await resolveLang());
  const missing = missingConfig();
  if (missing.length)
    return (
      <StateMessage tone="error" heading="h1" title={t.home.notConfigured}>
        <p className="state-detail">{t.home.setVars(missing.join(", "))}</p>
      </StateMessage>
    );
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 100);
  return (
    <>
      <Suspense fallback={<span className="eyebrow sk-inline skeleton" aria-hidden="true" />}>
        <ArtistLine />
      </Suspense>
      <h1>{t.home.title}</h1>
      <Form action="/" role="search" className="search">
        <label htmlFor="q" className="sr-only">
          {t.home.searchProducts}
        </label>
        <Icon name="search" />
        <input key={q} id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder={t.home.searchProducts} enterKeyHint="search" autoComplete="off" />
      </Form>
      <Suspense key={q} fallback={<Loading label={q ? t.home.searching : t.home.loadingProducts}><GridSkeleton /></Loading>}>
        <Catalogue q={q} />
      </Suspense>
    </>
  );
}

/** "ILHAMFADHEEL · OFFICIAL MERCH": whose fan club this is, now that the header carries the club's name. */
async function ArtistLine() {
  const lang = await resolveLang();
  const t = dict(lang);
  const artist = await shop.artist(lang).then((a) => a[0]).catch(() => undefined);
  return <p className="eyebrow">{artist?.name ? t.home.artistMerch(artist.name) : t.home.officialMerch}</p>;
}

/**
 * A card whose cover is still a video (a Creator API older than the video-cover rule, which sends
 * no `coverVideoUrl`) gets its product's first image here; null when it has none. Newer APIs do
 * this themselves, so this never fetches once they're deployed.
 */
async function withImageCover(p: ProductCard, lang?: string): Promise<ProductCard> {
  if (p.coverVideoUrl !== undefined || !isVideoUrl(p.coverUrl)) return p;
  const detail = await shop.product(p.productId, lang).catch(() => null);
  const image = detail ? galleryItems(detail.media).find((m) => m.type === "IMAGE") : undefined;
  return { ...p, coverUrl: image?.url ?? null, coverVideoUrl: p.coverUrl };
}

/** Streams in after the heading; the grid skeleton holds the same boxes meanwhile. `q` = the search, "" for all. */
async function Catalogue({ q }: { q: string }) {
  const lang = await resolveLang();
  const t = dict(lang);
  let page: { items: ProductCard[]; total: number } | undefined;
  let error: string | undefined;
  try {
    page = await shop.products(1, 48, lang, q || undefined);
    page = { ...page, items: await Promise.all(page.items.map((p) => withImageCover(p, lang))) };
  } catch (e) {
    error = errorText(e);
  }
  if (error)
    return (
      <StateMessage
        tone="error"
        title={t.home.couldntLoad}
        actions={
          <a href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="btn btn-primary">
            <Icon name="refresh" />
            {t.common.tryAgain}
          </a>
        }
      >
        <p>{t.home.noAnswer}</p>
        <p className="state-detail">{error}</p>
      </StateMessage>
    );
  if (q && (!page || page.items.length === 0))
    return (
      <StateMessage
        icon="search"
        title={t.home.noMatches}
        actions={
          <Link href="/" className="btn">
            {t.home.showAll}
          </Link>
        }
      >
        <p>{t.home.nothingNamed(q)}</p>
      </StateMessage>
    );
  if (!page || page.items.length === 0)
    return (
      <StateMessage icon="bag" title={t.home.noProducts}>
        <p>{t.home.checkBack}</p>
      </StateMessage>
    );
  return (
    <>
    {q ? (
      <p className="search-summary" role="status">
        {t.home.matches(page.total, q)}
        {page.total > page.items.length ? t.home.showingFirst(page.items.length) : ""} ·{" "}
        <Link href="/" className="link">
          {t.home.clear}
        </Link>
      </p>
    ) : null}
    <ul className="grid" role="list">
      {page.items.map((p, i) => (
        <li key={p.productId}>
          <Link href={`/products/${p.productId}`} className="card">
            <Cover className="card-media" src={coverImage(p.coverUrl)} alt="" width={400} height={400} loading={i < 4 ? "eager" : "lazy"} decoding="async" />
            <div className="card-body">
              <span className="card-title">{p.title}</span>
              <span className="price">{p.minPrice === p.maxPrice ? money(p.minPrice, p.currency) : `${money(p.minPrice, p.currency)} – ${money(p.maxPrice, p.currency)}`}</span>
              <span className="meta cap">{isSoldOut(p) ? t.home.soldOut : p.newProduct ? t.home.newProduct : p.limited ? t.home.limited : p.mainCategoryName ?? ""}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
    </>
  );
}
