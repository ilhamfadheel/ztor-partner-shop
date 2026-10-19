import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { LangProvider } from "@/components/LangProvider";
import { docsUrl } from "@/lib/config";
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
    <html lang={htmlLang(lang)} className={satoshi.variable}>
      <body>
        <LangProvider lang={lang}>
          <a href="#main" className="skip-link">{t.layout.skipToContent}</a>
          <Header />
          <main id="main" className="container">{children}</main>
          <footer className="footer">
            <div className="footer-bar">
              <div>
                <p>{t.layout.poweredByBefore}<span className="ztor-mark">Ztor</span>{t.layout.poweredByAfter}</p>
                <p className="footer-note">
                  {t.layout.demoBefore}
                  <a href={docsUrl()} className="link" target="_blank" rel="noreferrer">{t.layout.demoLink}</a>
                  {t.layout.demoAfter}
                </p>
              </div>
              <div className="footer-links">
                <a href={docsUrl()} className="footer-link" target="_blank" rel="noreferrer">
                  <Icon name="arrow-up-right" />
                  {t.layout.docs}
                </a>
                <a href="https://github.com/ilhamfadheel/ztor-partner-shop" className="footer-link">
                  <Icon name="github" />
                  {t.layout.source}
                </a>
              </div>
            </div>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
