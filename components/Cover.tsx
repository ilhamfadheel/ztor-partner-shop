"use client";
import { useState } from "react";

/** A product image that falls back to the empty tile (same box) when the file doesn't load. */
export function Cover({ src, className, ...img }: { src: string | undefined; className: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "className">) {
  const [broken, setBroken] = useState<string>();
  if (!src || broken === src) return <span className={className} aria-hidden="true" />;
  return <img className={className} src={src} onError={() => setBroken(src)} {...img} />;
}
