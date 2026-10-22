import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { LangProvider } from "@/components/LangProvider";
import { dict, htmlLang } from "@/lib/i18n";
import { resolveLang } from "@/lib/lang";
import "./globals.css";

const satoshi = localFont({ src: "./fonts/Satoshi-Variable.woff2", weight: "300 900", display: "swap", variable: "--font-body" });

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await resolveLang());
  return {
    title: { default: t.layout.siteName, template: `%s · ${t.layout.siteName}` },
    description: t.layout.metaDescription,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await resolveLang();
  const t = dict(lang);
  return (
    // data-page="club": LLOUD's header and footer (public/css/club.css) read their colours from it,
    // exactly as on the LLOUD pages.
    <html lang={htmlLang(lang)} className={satoshi.variable} data-page="club">
      <head>
        {/* LLOUD's own stylesheets for the header and footer: its fonts and club.css (classes only, no resets). */}
        <link rel="stylesheet" href="/css/fonts.css" />
        <link rel="stylesheet" href="/css/club.css" />
      </head>
      <body>
        <LangProvider lang={lang}>
          <a href="#main" className="skip-link">{t.layout.skipToContent}</a>
          <Header />
          <main id="main" className="container">{children}</main>
          {/* lloud.club's footer, as on the LLOUD pages (public/js/club.js). */}
          <footer className="club-footer">
            <span>{t.layout.clubTagline}</span>
            <span>
              {t.layout.poweredByZtor} · <a href="/account">{t.layout.footerAccount}</a> · <a href="/">{t.layout.backToRunway}</a>
            </span>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
