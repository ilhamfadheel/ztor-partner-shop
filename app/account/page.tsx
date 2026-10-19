"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { SignInPrompt } from "@/components/Gate";
import { useSession } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { useLang, useT } from "@/components/LangProvider";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { account, AccountError, hostedSettings, type AccountView } from "@/lib/account";
import { asLang, storeLangCookie } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { signOut, type Session } from "@/lib/oidc";
import { Addresses, Payments, Personal, Security } from "./sections";

/** lloud.club/account's sections, minus what this shop has no data for. Orders opens its own page. */
const SECTIONS = [
  { id: "personal" },
  { id: "addresses" },
  { id: "payments" },
  { id: "orders", href: "/orders" },
  { id: "security" },
] as const;
type SectionId = Exclude<(typeof SECTIONS)[number]["id"], "orders">;
const hrefOf = (s: (typeof SECTIONS)[number]) => ("href" in s ? s.href : s.id === "personal" ? "/account" : `/account?section=${s.id}`);
const labelOf = (id: (typeof SECTIONS)[number]["id"], t: Messages) =>
  ({ personal: t.account.personal, addresses: t.account.addresses, payments: t.account.payments, orders: t.account.ordersReturns, security: t.account.security })[id];

export default function AccountPage() {
  const t = useT();
  return (
    <Suspense fallback={<Loading label={t.account.loading}><LinesSkeleton rows={3} /></Loading>}>
      <Account />
    </Suspense>
  );
}

/** lloud.club/edit-profile: "Your account." with the sections down the side (a picker on phones), one panel at a time. Signed out, the same page asks for sign-in in the panel. */
function Account() {
  const t = useT();
  const lang = useLang();
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("section");
  const section: SectionId = (["personal", "addresses", "payments", "security"] as const).find((id) => id === requested) ?? "personal";
  const [me, setMe] = useState<AccountView | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    if (!session) return;
    setError(null);
    account.get(session.accessToken).then(setMe).catch((e: Error) => setError(e));
  }, [session]);
  useEffect(load, [load]);

  // The account's saved language leads this site: when they differ (just saved on this page, or
  // signed in on a device that was on another language), move the cookie and re-render everything.
  useEffect(() => {
    const saved = asLang(me?.language);
    if (saved && saved !== lang) {
      storeLangCookie(saved);
      router.refresh();
    }
  }, [me?.language, lang, router]);

  const go = (id: string) => {
    const target = SECTIONS.find((s) => s.id === id);
    if (target) router.push(hrefOf(target), { scroll: false });
  };
  const since = me?.createdAt ? new Date(me.createdAt).getFullYear() : null;
  const sectionLabel = labelOf(section, t);

  return (
    <div className="account-page">
      <Link href="/" className="back-link">
        <Icon name="arrow-left" />
        {t.account.backToShop}
      </Link>
      <div className="account-head">
        <h1>{t.account.yourAccount}</h1>
        {me ? <p className="meta">{[me.name, since ? t.account.memberSinceYear(since) : null].filter(Boolean).join(" · ")}</p> : null}
      </div>
      <div className="account-layout">
        <aside className="account-side">
          <label className="account-picker">
            <span className="sr-only">{t.account.sectionPicker}</span>
            <select value={section} onChange={(e) => go(e.target.value)}>
              {SECTIONS.map((s) => <option key={s.id} value={s.id}>{labelOf(s.id, t)}</option>)}
            </select>
            <Icon name="chevron-down" />
          </label>
          <nav className="account-nav" aria-label={t.account.sections}>
            {SECTIONS.map((s) => (
              <Link key={s.id} href={hrefOf(s)} scroll={false} aria-current={s.id === section ? "page" : undefined}>
                {labelOf(s.id, t)}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="account-panel" aria-labelledby="account-panel-title">
          {session === undefined ? (
            <Loading label={t.account.loading}><LinesSkeleton rows={3} /></Loading>
          ) : session === null ? (
            <>
              <h2 id="account-panel-title">{sectionLabel}</h2>
              <SignInPrompt title={t.account.signInToSee} />
            </>
          ) : (
            <Panel section={section} session={session} me={me} error={error} reload={load} setMe={setMe} />
          )}
        </section>
        {session ? <button className="account-signout" onClick={() => void signOut()}>{t.account.signOut}</button> : null}
      </div>
    </div>
  );
}

function Panel({ section, session, me, error, reload, setMe }: { section: SectionId; session: Session; me: AccountView | null; error: Error | null; reload: () => void; setMe: (me: AccountView) => void }) {
  const t = useT();
  // Addresses and payment methods come from the shop, not the account service: they open even if the account doesn't.
  if (section === "addresses") return <Addresses token={session.accessToken} />;
  if (section === "payments") return <Payments token={session.accessToken} />;
  if (error)
    return (
      <StateMessage
        tone="error"
        title={t.account.didntOpen}
        actions={
          <>
            <button className="btn btn-primary" onClick={reload}>
              <Icon name="refresh" />
              {t.common.tryAgain}
            </button>
            <a className="btn" href={hostedSettings()} target="_blank" rel="noreferrer">
              {t.account.openSettings}
              <Icon name="arrow-up-right" />
            </a>
          </>
        }
      >
        <p>{error instanceof AccountError && (error.reason === "UNAVAILABLE" || error.reason === "UNAUTHENTICATED") ? t.account.cantReach : t.account.somethingWrong}</p>
        <p className="state-detail">{error.message}</p>
      </StateMessage>
    );
  if (!me) return <Loading label={t.account.loading}><LinesSkeleton rows={3} /></Loading>;
  return section === "security" ? <Security me={me} /> : <Personal token={session.accessToken} me={me} onChange={setMe} />;
}
