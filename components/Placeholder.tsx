/**
 * The "no image" thumbnail, WooCommerce-style: a quiet square with an outlined photo glyph,
 * sized to whatever box it stands in for (card, gallery, line thumb). Drawn with the theme's
 * tokens, so it follows the palette. Decorative: the product's name is always beside it.
 */
export function Placeholder({ className }: { className: string }) {
  return (
    <span className={`${className} media-placeholder`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <rect x="8" y="12" width="48" height="40" rx="3" />
        <circle cx="23" cy="25" r="4.5" />
        <path d="m8 44 14-13 10 9 8-7 16 14" />
      </svg>
    </span>
  );
}
