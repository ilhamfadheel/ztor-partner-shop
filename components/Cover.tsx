"use client";
import { useState } from "react";
import { Placeholder } from "./Placeholder";

/** A product image that falls back to the "no image" placeholder (same box) when there's none or the file doesn't load. */
export function Cover({ src, className, ...img }: { src: string | undefined; className: string } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "className">) {
  const [broken, setBroken] = useState<string>();
  if (!src || broken === src) return <Placeholder className={className} />;
  return <img className={className} src={src} onError={() => setBroken(src)} {...img} />;
}
