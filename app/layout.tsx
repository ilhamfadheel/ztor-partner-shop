import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { docsUrl } from "@/lib/config";
import "./globals.css";

// Satoshi (Fontshare, free for commercial use), the lloud.club typeface: one variable file, 300–900,
// self-hosted by next/font, swap + size-adjusted fallback = no invisible text, no reflow.
const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", weight: "300 900", display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "Fan Club", template: "%s · Fan Club" },
  description: "Official merch — sign in with Ztor to buy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={satoshi.variable}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main" className="container">{children}</main>
        <footer className="footer">
          <div className="footer-bar">
            <div>
              <p>Fan Club · Powered by <span className="ztor-mark">Ztor</span>, one account for every artist site.</p>
              <p className="footer-note">
                This site is a demo, built only from the{" "}
                <a href={docsUrl()} className="link" target="_blank" rel="noreferrer">Ztor Partner API docs</a>: sign-in, shop, checkout and account, as a partner site would build them.
              </p>
            </div>
            <div className="footer-links">
              <a href={docsUrl()} className="footer-link" target="_blank" rel="noreferrer">
                <Icon name="arrow-up-right" />
                Docs
              </a>
              <a href="https://github.com/ilhamfadheel/ztor-partner-shop" className="footer-link">
                <Icon name="github" />
                Source
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
