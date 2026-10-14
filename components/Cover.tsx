"use client";
import { useEffect, useRef, useState } from "react";
import { Placeholder } from "./Placeholder";

/**
 * A product image that falls back to the "no image" placeholder (same box) when there's none or
 * the file doesn't load. A server-rendered <img> can fail before hydration attaches onError, so
 * on mount it also checks whether the browser already gave up on it (complete, no pixels).
 */
export function Cover({ src, className, ...img }: { src: string | undefined; className: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "className">) {
  const [broken, setBroken] = useState<string>();
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (src && el?.complete && el.naturalWidth === 0) setBroken(src);
  }, [src]);
  if (!src || broken === src) return <Placeholder className={className} />;
  return <img ref={ref} className={className} src={src} onError={() => setBroken(src)} {...img} />;
}
