import type { NextConfig } from "next";

/**
 * The LLOUD pages (Asana 1219623889042756) are LLOUD's own static site under public/, served at
 * clean URLs. The runway's films are not in this repository (Git LFS, ~430 MB): they are served
 * from the original LLOUD site (CORS *), override with LLOUD_MEDIA_ORIGIN.
 */
const LLOUD_PAGES = ["fan-club", "loyalty", "rewards", "leaderboard", "shop", "product", "checkout", "account", "edit-profile", "signup", "auction"];
const LLOUD_MEDIA_ORIGIN = (process.env.LLOUD_MEDIA_ORIGIN || "https://lloud.club").replace(/\/+$/, "");

const config: NextConfig = {
  reactStrictMode: true,
  // The React pages LLOUD's replaced: old links (emails, bookmarks) still land.
  async redirects() {
    return [
      { source: "/cart", destination: "/shop?view=bag", permanent: false },
      // Clean URLs only: an old ".html" link (or bookmark) lands on the page's real address.
      { source: "/index.html", destination: "/", permanent: true },
      ...LLOUD_PAGES.map((page) => ({ source: `/${page}.html`, destination: `/${page}`, permanent: true })),
      { source: "/products/:id", destination: "/product?id=:id", permanent: false },
      // The runway's films go to the LLOUD site itself, not through a rewrite: Vercel's edge caches a
      // proxied 206 (one byte range) and serves it for every Range asked, so the browser got the
      // middle of a film for its first bytes and the runway fell back to stills.
      { source: "/assets/fashion/:path(.*\\.mp4)", destination: `${LLOUD_MEDIA_ORIGIN}/assets/fashion/:path`, permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }, ...LLOUD_PAGES.map((page) => ({ source: `/${page}`, destination: `/${page}.html` }))],
      afterFiles: [],
      fallback: [{ source: "/assets/fashion/:path*", destination: `${LLOUD_MEDIA_ORIGIN}/assets/fashion/:path*` }],
    };
  },
};
export default config;
