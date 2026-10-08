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
