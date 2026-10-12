"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Gate } from "@/components/Gate";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { account, AccountError, hostedSettings, type AccountView } from "@/lib/account";
import { signOut, type Session } from "@/lib/oidc";
import { Consents, Personal, Platforms, Security, Sessions } from "./sections";

const SECTIONS = [
  { id: "personal", label: "Personal details" },
  { id: "platforms", label: "Connected sites" },
  { id: "sessions", label: "Signed-in devices" },
  { id: "privacy", label: "Privacy & consents" },
  { id: "security", label: "Security & sign-in" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function AccountPage() {
  return (
    <Gate title="Sign in to see your account" fallback={<Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>}>
      {(session) => (
        <Suspense fallback={<Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>}>
          <Account session={session} />
        </Suspense>
      )}
    </Gate>
  );
}

/** lloud.club/edit-profile: "Your account." with the sections down the side (a picker on phones) and one panel at a time. */
function Account({ session }: { session: Session }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("section");
  const section: SectionId = SECTIONS.some((s) => s.id === requested) ? (requested as SectionId) : "personal";
  const [me, setMe] = useState<AccountView | null>(null);
  const [error, setError] = useState<AccountError | Error | null>(null);

  const load = useCallback(() => {
    setError(null);
    account.get(session.accessToken).then(setMe).catch((e: Error) => setError(e));
  }, [session.accessToken]);
  useEffect(load, [load]);

  const go = (id: SectionId) => router.replace(id === "personal" ? "/account" : `/account?section=${id}`, { scroll: false });
  const since = me?.createdAt ? new Date(me.createdAt).getFullYear() : null;

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

      {error ? (
        <StateMessage
          tone="error"
          title="Your account didn’t open here"
          actions={
            <>
              <button className="btn btn-primary" onClick={load}>
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
      ) : !me ? (
        <Loading label="Loading your account…"><LinesSkeleton rows={3} /></Loading>
      ) : (
        <div className="account-layout">
          <aside className="account-side">
            <label className="account-picker">
              <span className="sr-only">Account section</span>
              <select value={section} onChange={(e) => go(e.target.value as SectionId)}>
                {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <Icon name="chevron-down" />
            </label>
            <nav className="account-nav" aria-label="Account sections">
              {SECTIONS.map((s) => (
                <Link key={s.id} href={s.id === "personal" ? "/account" : `/account?section=${s.id}`} scroll={false} aria-current={s.id === section ? "page" : undefined}>
                  {s.label}
                </Link>
              ))}
            </nav>
          </aside>
          <section className="account-panel" aria-labelledby="account-panel-title">
            {section === "personal" ? <Personal token={session.accessToken} me={me} onChange={setMe} /> : null}
            {section === "platforms" ? <Platforms token={session.accessToken} /> : null}
            {section === "sessions" ? <Sessions token={session.accessToken} /> : null}
            {section === "privacy" ? <Consents token={session.accessToken} /> : null}
            {section === "security" ? <Security me={me} /> : null}
          </section>
          <button className="account-signout" onClick={() => void signOut()}>Sign out</button>
        </div>
      )}
    </div>
  );
}
