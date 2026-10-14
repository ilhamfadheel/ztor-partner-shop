"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import type { GalleryItem } from "@/lib/media";

/**
 * The product gallery: one large slot and up to six thumbnails, in the seller's order. A video
 * plays in the large slot (controls, inline, no autoplay) with the first image as its poster, and
 * its thumbnail is that poster with a play mark — a video URL never goes into an <img>.
 */
export function Gallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const poster = items.find((m) => m.type === "IMAGE")?.url;
  const shown = items[current];
  return (
    <div className="gallery">
      {!shown ? (
        <span className="gallery-main" aria-hidden="true" />
      ) : shown.type === "VIDEO" ? (
        <video key={shown.url} className="gallery-main" src={shown.url} poster={poster} controls playsInline preload="metadata" aria-label={`${title}, video`} />
      ) : (
        <img className="gallery-main" src={shown.url} alt={title} width={800} height={800} fetchPriority={current === 0 ? "high" : undefined} decoding="async" />
      )}
      {items.length > 1 ? (
        <ul className="thumbs" role="list">
          {items.slice(0, 6).map((m, i) => (
            <li key={`${m.url}-${i}`}>
              <button type="button" className="thumb" aria-pressed={i === current} aria-label={m.type === "VIDEO" ? `${title}, play video` : `${title}, image ${i + 1}`} onClick={() => setCurrent(i)}>
                {m.type === "VIDEO" ? (
                  <>
                    {poster ? <img src={poster} alt="" width={160} height={160} loading="lazy" decoding="async" /> : <span className="thumb-blank" />}
                    <span className="thumb-play" aria-hidden="true"><Icon name="play" /></span>
                  </>
                ) : (
                  <img src={m.url} alt="" width={160} height={160} loading="lazy" decoding="async" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
