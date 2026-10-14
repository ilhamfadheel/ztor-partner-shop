import { config } from "./config.ts";

/** A product media path → an absolute URL on Shopping's CDN (absolute URLs pass through). Undefined = nothing to show. */
export function mediaUrl(src: string | null | undefined): string | undefined {
  if (!src?.trim()) return undefined;
  try {
    const url = new URL(src.trim(), `${config.media}/`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const VIDEO_FILE = /\.(mp4|m4v|mov|webm|m3u8)$/i;

/** A video, read off the path only (a signed URL's query is noise): its file type or Merchandise's `video/` folder. */
export function isVideoUrl(src: string | null | undefined): boolean {
  const url = mediaUrl(src);
  if (!url) return false;
  const path = new URL(url).pathname;
  return VIDEO_FILE.test(path) || /^\/video\//i.test(path);
}

/** A card's thumbnail: its cover only when that is an image — a cover <img> must never get an .mp4. */
export const coverImage = (src: string | null | undefined): string | undefined => (isVideoUrl(src) ? undefined : mediaUrl(src));

export type GalleryItem = { type: "IMAGE" | "VIDEO"; url: string };

/** The product's gallery in order (videos where the seller put them), absolute URLs, unusable entries dropped. */
export function galleryItems(media: readonly { type: string; url: string; sortOrder: number }[]): GalleryItem[] {
  return [...media]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({ type: m.type === "VIDEO" || isVideoUrl(m.url) ? ("VIDEO" as const) : ("IMAGE" as const), url: mediaUrl(m.url) }))
    .filter((m): m is GalleryItem => m.url !== undefined);
}
