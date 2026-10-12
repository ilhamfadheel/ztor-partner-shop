"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { SignInPrompt } from "@/components/Gate";
import { useSession } from "@/components/Header";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { account, AccountError, hostedSettings, type AccountView } from "@/lib/account";
import { signOut, type Session } from "@/lib/oidc";
import { Addresses, Payments, Personal, Security } from "./sections";

/** lloud.club/account's sections, minus what this shop has no data for. Orders opens its own page. */
const SECTIONS = [
  { id: "personal", label: "Personal details" },
  { id: "addresses", label: "Addresses" },
  { id: "payments", label: "Payment methods" },
  { id: "orders", label: "Orders & returns", href: "/orders" },
  { id: "security", label: "Security & privacy" },
] as const;
type SectionId = Exclude<(typeof SECTIONS)[number]["id"], "orders">;
const hrefOf = (s: (typeof SECTIONS)[number]) => ("href" in s ? s.href : s.id === "personal" ? "/account" : `/account?section=${s.id}`);

export default function AccountPage() {
  return (
    <Suspense fallback={<Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>}>
      <Account />
    </Suspense>
  );
}

/** lloud.club/edit-profile: "Your account." with the sections down the side (a picker on phones), one panel at a time. Signed out, the same page asks for sign-in in the panel. */
function Account() {
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

  const go = (id: string) => {
    const target = SECTIONS.find((s) => s.id === id);
    if (target) router.push(hrefOf(target), { scroll: false });
  };
  const since = me?.createdAt ? new Date(me.createdAt).getFullYear() : null;
  const sectionLabel = SECTIONS.find((s) => s.id === section)!.label;

  return (
    <div className="account-page">
      <Link href="/" className="back-link">
        <Icon name="arrow-left" />
        Back to shop
      </Link>
      <div className="account-head">
        <h1>Your account.</h1>
        {me ? <p className="meta">{[me.name, since ? `Member since ${since}` : null].filter(Boolean).join(" · ")}</p> : null}
      </div>
      <div className="account-layout">
        <aside className="account-side">
          <label className="account-picker">
            <span className="sr-only">Account section</span>
            <select value={section} onChange={(e) => go(e.target.value)}>
              {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <Icon name="chevron-down" />
          </label>
          <nav className="account-nav" aria-label="Account sections">
            {SECTIONS.map((s) => (
              <Link key={s.id} href={hrefOf(s)} scroll={false} aria-current={s.id === section ? "page" : undefined}>
                {s.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="account-panel" aria-labelledby="account-panel-title">
          {session === undefined ? (
            <Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>
          ) : session === null ? (
            <>
              <h2 id="account-panel-title">{sectionLabel}</h2>
              <SignInPrompt title="Sign in to see your account" />
            </>
          ) : (
            <Panel section={section} session={session} me={me} error={error} reload={load} setMe={setMe} />
          )}
        </section>
        {session ? <button className="account-signout" onClick={() => void signOut()}>Sign out</button> : null}
      </div>
    </div>
  );
}

function Panel({ section, session, me, error, reload, setMe }: { section: SectionId; session: Session; me: AccountView | null; error: Error | null; reload: () => void; setMe: (me: AccountView) => void }) {
  // Addresses and payment methods come from the shop, not the account service: they open even if the account doesn't.
  if (section === "addresses") return <Addresses token={session.accessToken} />;
  if (section === "payments") return <Payments token={session.accessToken} />;
  if (error)
    return (
      <StateMessage
        tone="error"
        title="Your account didn’t open here"
        actions={
          <>
            <button className="btn btn-primary" onClick={reload}>
              <Icon name="refresh" />
              Try again
            </button>
            <a className="btn" href={hostedSettings()} target="_blank" rel="noreferrer">
              Open Ztor account settings
              <Icon name="arrow-up-right" />
            </a>
          </>
        }
      >
        <p>{error instanceof AccountError && (error.reason === "UNAVAILABLE" || error.reason === "UNAUTHENTICATED") ? "This site can’t reach your Ztor account right now. Your settings are always on Ztor." : "Something went wrong loading your account."}</p>
        <p className="state-detail">{error.message}</p>
      </StateMessage>
    );
  if (!me) return <Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>;
  return section === "security" ? <Security me={me} /> : <Personal token={session.accessToken} me={me} onChange={setMe} />;
}
