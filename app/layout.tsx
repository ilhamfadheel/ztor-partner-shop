import type { Metadata } from "next";
import { Nunito_Sans, Rubik } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

// Self-hosted by next/font (no request to Google at runtime), swap + size-adjusted fallback = no invisible text, no reflow.
const body = Nunito_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });
const heading = Rubik({ subsets: ["latin"], display: "swap", variable: "--font-heading" });

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s · Shop" },
  description: "Official merch — sign in with Ztor to buy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main" className="container">{children}</main>
        <footer className="footer">
          <div className="container footer-bar">
            <p>Powered by <span className="ztor-mark">Ztor</span> — one account, every artist site.</p>
            <a href="https://github.com/ilhamfadheel/ztor-partner-shop" className="footer-link">Source</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
