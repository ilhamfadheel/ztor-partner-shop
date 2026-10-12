/** The shop's mark: the bag tile from the favicon (app/icon.svg), drawn in the theme's ink so it follows the palette. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect className="logo-tile" width="64" height="64" />
      <g className="logo-glyph" transform="translate(12 12) scale(1.6667)" fill="none" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </g>
    </svg>
  );
}
