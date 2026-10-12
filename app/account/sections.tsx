"use client";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { account, AccountError, deviceName, hostedSettings, type AccountView, type ConnectedPlatform, type ConsentRecord, type SessionView } from "@/lib/account";
import { config } from "@/lib/config";
import { clearSession } from "@/lib/oidc";

const day = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso)) : "—");
const moment = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const problem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Leaves this site signed out after an action that ended its own grant (disconnecting it, signing out everywhere). */
function leave() {
  clearSession();
  location.assign("/");
}

/** "Manage on Ztor ↗": the account settings partner sites don't change (email, password, 2FA, sign-ins, deletion). */
function OnZtor({ page = "security", children = "Manage on Ztor" }: { page?: "security" | "connected"; children?: ReactNode }) {
  return (
    <a className="link-out" href={hostedSettings(page)} target="_blank" rel="noreferrer">
      {children}
      <Icon name="arrow-up-right" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Loads one list for a panel; `reload` after a change. */
function useList<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    load().then(setItems).catch((e) => setError(problem(e)));
  }, [load]);
  useEffect(reload, [reload]);
  return { items, error, reload };
}

function ListState<T>({ items, error, reload, empty, children }: { items: T[] | null; error: string | null; reload: () => void; empty: string; children: (items: T[]) => ReactNode }) {
  if (error)
    return (
      <StateMessage tone="error" title="Couldn’t load this" actions={<button className="btn" onClick={reload}><Icon name="refresh" />Try again</button>}>
        <p className="state-detail">{error}</p>
      </StateMessage>
    );
  if (!items) return <Loading label="Loading…"><LinesSkeleton rows={2} /></Loading>;
  if (items.length === 0) return <p className="meta">{empty}</p>;
  return <>{children(items)}</>;
}

// ---- Personal details: avatar, display name (PATCH), contact details (read-only here)

export function Personal({ token, me, onChange }: { token: string; me: AccountView; onChange: (me: AccountView) => void }) {
  const [name, setName] = useState(me.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const trimmed = name.trim();
  const dirty = trimmed !== (me.name ?? "");
  const invalid = trimmed.length === 0 || trimmed.length > 16;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || invalid) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await account.rename(token, trimmed);
      onChange(updated);
      setName(updated.name ?? "");
      setSaved(true);
    } catch (err) {
      setError(err instanceof AccountError ? (err.fields?.name ?? err.message) : problem(err));
    } finally {
      setBusy(false);
    }
  };

  const initial = (me.name || me.email || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <h2 id="account-panel-title">Personal details</h2>
      <div className="profile">
        {me.avatarUrl ? <img className="profile-avatar" src={me.avatarUrl} alt="" width={80} height={80} /> : <span className="profile-avatar" aria-hidden="true">{initial}</span>}
        <div className="profile-who">
          <p className="profile-name">{me.name || "No display name yet"}</p>
          <p className="meta">{me.createdAt ? `Member since ${day(me.createdAt)}` : "Ztor member"}</p>
        </div>
      </div>
      <p className="meta">Profile photo · changed on Ztor, shown on every artist site. <OnZtor>Change photo</OnZtor></p>

      <form className="account-form" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            name="name"
            value={name}
            maxLength={16}
            autoComplete="nickname"
            aria-invalid={error || (dirty && invalid) ? true : undefined}
            aria-describedby="display-name-help"
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
              setError(null);
            }}
          />
          <p id="display-name-help" className="field-help">The name on your orders and on every artist site you use with Ztor. 1 to 16 characters.</p>
          {error ? <p className="field-error" role="alert"><Icon name="alert" />{error}</p> : null}
        </div>
        <div className="form-bar">
          <p className="meta" role="status">{busy ? "Saving…" : saved ? "Saved." : dirty ? "Unsaved changes" : "No unsaved changes"}</p>
          <div className="form-bar-actions">
            <button type="button" className="btn" disabled={!dirty || busy} onClick={() => { setName(me.name ?? ""); setError(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!dirty || invalid || busy}>{busy ? <span className="spinner" aria-hidden="true" /> : null}Save changes</button>
          </div>
        </div>
      </form>

      <div className="account-block">
        <h3>Contact details</h3>
        <p className="meta">Your sign-in email and phone belong to your Ztor account, so they change on Ztor.</p>
        <dl className="facts">
          <div><dt>Email address</dt><dd>{me.email ?? "—"}{me.pendingEmail ? <span className="meta"> · changing to {me.pendingEmail}, waiting for its code</span> : null}</dd></div>
          <div><dt>Phone number</dt><dd>{me.phone ?? "—"}</dd></div>
        </dl>
        <OnZtor>Change email or phone on Ztor</OnZtor>
      </div>
    </>
  );
}

// ---- Connected sites (GET / DELETE platforms)

export function Platforms({ token }: { token: string }) {
  const load = useCallback(() => account.platforms(token), [token]);
  const { items, error, reload } = useList<ConnectedPlatform>(load);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const disconnect = async (p: ConnectedPlatform) => {
    setBusy(p.clientId);
    setFailed(null);
    try {
      await account.disconnect(token, p.clientId);
      if (p.clientId === config.clientId) return leave();
      setConfirming(null);
      reload();
    } catch (e) {
      setFailed(problem(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2 id="account-panel-title">Connected sites</h2>
      <p className="meta">Artist sites you signed in to with your Ztor account. Disconnecting one signs you out of it; you can sign in again any time.</p>
      {failed ? <p className="field-error" role="alert"><Icon name="alert" />{failed}</p> : null}
      <ListState items={items} error={error} reload={reload} empty="No other sites yet.">
        {(list) => (
          <ul className="rows" role="list">
            {list.map((p) => (
              <li key={p.clientId} className="row">
                {p.logoUrl ? <img className="row-mark" src={p.logoUrl} alt="" width={40} height={40} /> : <span className="row-mark" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>}
                <div className="row-text">
                  <p className="row-title">{p.name}{p.clientId === config.clientId ? <span className="tag">This site</span> : null}</p>
                  <p className="meta">Last signed in {day(p.lastSignedInAt)} · first {day(p.firstSignedInAt)}</p>
                </div>
                {confirming === p.clientId ? (
                  <div className="row-confirm" role="group" aria-label={`Disconnect ${p.name}?`}>
                    <span className="meta">{p.clientId === config.clientId ? "This signs you out here." : `Sign out of ${p.name}?`}</span>
                    <button className="btn" onClick={() => setConfirming(null)} disabled={busy === p.clientId}>Keep</button>
                    <button className="btn btn-danger" onClick={() => void disconnect(p)} disabled={busy === p.clientId}>{busy === p.clientId ? <span className="spinner" aria-hidden="true" /> : null}Disconnect</button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => setConfirming(p.clientId)}>Disconnect</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </>
  );
}

// ---- Signed-in devices (GET / DELETE sessions, POST revoke-all)

export function Sessions({ token }: { token: string }) {
  const load = useCallback(() => account.sessions(token), [token]);
  const { items, error, reload } = useList<SessionView>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [everywhere, setEverywhere] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>, after: () => void) => {
    setBusy(id);
    setFailed(null);
    try {
      await action();
      after();
    } catch (e) {
      setFailed(problem(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2 id="account-panel-title">Signed-in devices</h2>
      <p className="meta">Where your Ztor account is signed in. Signing a device out ends its Ztor session and the artist sites it opened.</p>
      {failed ? <p className="field-error" role="alert"><Icon name="alert" />{failed}</p> : null}
      <ListState items={items} error={error} reload={reload} empty="No open sessions.">
        {(list) => (
          <ul className="rows" role="list">
            {list.map((s) => (
              <li key={s.id} className="row">
                <span className="row-mark" aria-hidden="true"><Icon name="monitor" /></span>
                <div className="row-text">
                  <p className="row-title">{deviceName(s.userAgent)}{s.current ? <span className="tag">This browser</span> : null}</p>
                  <p className="meta">{[s.ip, `active ${moment(s.lastActiveAt)}`].filter(Boolean).join(" · ")}</p>
                </div>
                {s.current ? null : (
                  <button className="btn" disabled={busy === s.id} onClick={() => void run(s.id, () => account.revokeSession(token, s.id), reload)}>
                    {busy === s.id ? <span className="spinner" aria-hidden="true" /> : null}Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </ListState>
      <div className="account-block">
        <h3>Sign out everywhere</h3>
        <p className="meta">Ends every Ztor session and every artist site’s access, this one included.</p>
        {everywhere ? (
          <div className="row-confirm" role="group" aria-label="Sign out everywhere?">
            <span className="meta">You’ll need to sign in again on every device.</span>
            <button className="btn" onClick={() => setEverywhere(false)} disabled={busy === "all"}>Keep me signed in</button>
            <button className="btn btn-danger" disabled={busy === "all"} onClick={() => void run("all", () => account.revokeAll(token), leave)}>
              {busy === "all" ? <span className="spinner" aria-hidden="true" /> : null}Sign out everywhere
            </button>
          </div>
        ) : (
          <button className="btn btn-danger" onClick={() => setEverywhere(true)}>Sign out everywhere</button>
        )}
      </div>
    </>
  );
}

// ---- Privacy & consents (GET consents), named by the connected-site list

export function Consents({ token }: { token: string }) {
  const load = useCallback(async () => {
    const [consents, platforms] = await Promise.all([account.consents(token), account.platforms(token).catch(() => [] as ConnectedPlatform[])]);
    const site = (id: string | null) => (id ? (platforms.find((p) => p.clientId === id)?.name ?? (id === config.clientId ? "This site" : id)) : "Ztor");
    return consents.map((c) => ({ ...c, site: site(c.clientId) }));
  }, [token]);
  const { items, error, reload } = useList<ConsentRecord & { site: string }>(load);
  const doc = (d: string) => (d === "terms" ? "Terms of service" : d === "privacy" ? "Privacy policy" : d.charAt(0).toUpperCase() + d.slice(1));
  return (
    <>
      <h2 id="account-panel-title">Privacy & consents</h2>
      <p className="meta">The terms and privacy policies you agreed to, and where.</p>
      <ListState items={items} error={error} reload={reload} empty="No consent records yet.">
        {(list) => (
          <ul className="rows" role="list">
            {list.map((c, i) => (
              <li key={`${c.document}-${c.version}-${c.clientId}-${i}`} className="row row-plain">
                <div className="row-text">
                  <p className="row-title">{doc(c.document)} <span className="meta">v{c.version}</span></p>
                  <p className="meta">Agreed {day(c.acceptedAt)} on {c.site}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListState>
    </>
  );
}

// ---- Security & sign-in: the state, changed on Ztor

const PROVIDER = { google: "Google", apple: "Apple", facebook: "Facebook", line: "LINE" } as const;

export function Security({ me }: { me: AccountView }) {
  return (
    <>
      <h2 id="account-panel-title">Security & sign-in</h2>
      <p className="meta">Your password, two-step verification and sign-in methods protect every artist site at once, so they’re managed on Ztor.</p>
      <dl className="facts facts-rows">
        <div><dt>Password</dt><dd>{me.hasPassword ? "Set" : "Not set: you sign in with a linked account"}</dd></div>
        <div><dt>Two-step verification</dt><dd>{me.mfa.totp ? `On · ${me.mfa.recoveryCodesRemaining} recovery ${me.mfa.recoveryCodesRemaining === 1 ? "code" : "codes"} left` : "Off"}</dd></div>
        <div>
          <dt>Sign-in methods</dt>
          <dd>{me.linkedProviders.length ? me.linkedProviders.map((l) => `${PROVIDER[l.provider] ?? l.provider}${l.email ? ` (${l.email})` : ""}`).join(", ") : "Email and password"}</dd>
        </div>
        {me.deletion ? <div><dt>Account deletion</dt><dd className="danger-text">Scheduled for {day(me.deletion.effectiveAt)}</dd></div> : null}
      </dl>
      <div className="account-actions">
        <a className="btn btn-primary" href={hostedSettings("security")} target="_blank" rel="noreferrer">
          Open Ztor security settings
          <Icon name="arrow-up-right" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <OnZtor page="connected">Linked sign-ins</OnZtor>
      </div>
    </>
  );
}
