import type { Metadata } from "next";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s · Shop" },
  description: "Official merch — sign in with Ztor to buy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            <span>Powered by <span className="ztor-mark">Ztor</span> — one account, every artist site.</span>
            <a href="https://github.com/ilhamfadheel/ztor-partner-shop">Source</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
