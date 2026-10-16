"use client";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { LinesSkeleton, Loading } from "@/components/Skeletons";
import { StateMessage } from "@/components/StateMessage";
import { account, AccountError, AVATAR_TYPES, BIO_MAX, hostedSettings, PROFILE_LANGUAGES, type AccountView, type ProfileLanguage, type ProfilePatch } from "@/lib/account";
import { preferredPayment, setPreferredPayment } from "@/lib/preferences";
import { errorText, shop, type PaymentMethod, type PickupContact } from "@/lib/shop";

const day = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso)) : "—");
const problem = (e: unknown) => errorText(e);

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
export function useList<T>(load: () => Promise<T[]>) {
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

// ---- Personal details: the profile a partner site may edit (name, bio, avatar, default language)

export function Personal({ token, me, onChange }: { token: string; me: AccountView; onChange: (me: AccountView) => void }) {
  const initial = { name: me.name ?? "", bio: me.bio ?? "", language: (me.language ?? "") as ProfileLanguage | "" };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState<{ busy?: boolean; error?: string }>({});

  const name = form.name.trim();
  const bio = form.bio.trim();
  const patch: ProfilePatch = {};
  if (name !== (me.name ?? "")) patch.name = name;
  if (bio !== (me.bio ?? "")) patch.bio = bio;
  if (form.language && form.language !== me.language) patch.language = form.language;
  const dirty = Object.keys(patch).length > 0;
  const invalid = name.length === 0 || name.length > 16 || [...bio].length > BIO_MAX;
  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    setErrors({});
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || invalid) return;
    setBusy(true);
    setErrors({});
    try {
      const updated = await account.update(token, patch);
      onChange(updated);
      setForm({ name: updated.name ?? "", bio: updated.bio ?? "", language: updated.language ?? "" });
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof AccountError ? (err.fields ?? { form: err.message }) : { form: problem(err) });
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhoto({ busy: true });
    try {
      onChange(await account.uploadAvatar(token, file));
      setPhoto({});
    } catch (err) {
      setPhoto({ error: err instanceof AccountError ? (err.fields?.avatarUrl ?? err.fields?.contentType ?? err.message) : problem(err) });
    }
  };
  const removePhoto = async () => {
    setPhoto({ busy: true });
    try {
      onChange(await account.update(token, { avatarUrl: null }));
      setPhoto({});
    } catch (err) {
      setPhoto({ error: problem(err) });
    }
  };

  const letter = (me.name || me.email || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <h2 id="account-panel-title">Personal details</h2>
      <div className="profile">
        <label className="profile-avatar profile-avatar-edit" aria-busy={photo.busy || undefined}>
          {me.avatarUrl ? <img src={me.avatarUrl} alt="" width={80} height={80} /> : <span aria-hidden="true">{letter}</span>}
          <span className="profile-avatar-label">{photo.busy ? <span className="spinner" aria-hidden="true" /> : "Edit"}</span>
          <input className="sr-only" type="file" accept={AVATAR_TYPES.join(",")} disabled={photo.busy} aria-label="Change profile photo" onChange={(e) => { void changePhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="profile-who">
          <p className="profile-name">{me.name || "No display name yet"}</p>
          <p className="meta">{me.createdAt ? `Member since ${day(me.createdAt)}` : "Ztor member"}</p>
          {me.avatarUrl ? <button type="button" className="link-button" onClick={() => void removePhoto()} disabled={photo.busy}>Remove photo</button> : null}
        </div>
      </div>
      <p className="meta">Profile photo · JPG, PNG or GIF · Up to 5 MB. It shows on every artist site you use with Ztor.</p>
      {photo.error ? <p className="field-error" role="alert"><Icon name="alert" />{photo.error}</p> : null}

      <form className="account-form" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" name="name" value={form.name} maxLength={16} autoComplete="nickname" aria-invalid={errors.name || name.length === 0 ? true : undefined} aria-describedby="display-name-help" onChange={(e) => set("name")(e.target.value)} />
          <p id="display-name-help" className="field-help">The name on your orders and on every artist site you use with Ztor. 1 to 16 characters.</p>
          {errors.name ? <p className="field-error" role="alert"><Icon name="alert" />{errors.name}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="bio">About you <span className="field-required">· Optional</span></label>
          <textarea id="bio" name="bio" rows={3} value={form.bio} aria-invalid={errors.bio || [...bio].length > BIO_MAX ? true : undefined} aria-describedby="bio-help" onChange={(e) => set("bio")(e.target.value)} />
          <p id="bio-help" className="field-help">A line or two for your Ztor profile. {[...bio].length} / {BIO_MAX}</p>
          {errors.bio ? <p className="field-error" role="alert"><Icon name="alert" />{errors.bio}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="language">Default language</label>
          <select id="language" name="language" value={form.language} onChange={(e) => set("language")(e.target.value)} aria-describedby="language-help">
            {!me.language ? <option value="">Not set</option> : null}
            {PROFILE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <p id="language-help" className="field-help">The language Ztor uses for you, including its emails.</p>
          {errors.language ? <p className="field-error" role="alert"><Icon name="alert" />{errors.language}</p> : null}
        </div>
        {errors.form ? <p className="field-error" role="alert"><Icon name="alert" />{errors.form}</p> : null}
        <div className="form-bar">
          <p className="meta" role="status">{busy ? "Saving…" : saved ? "Saved." : dirty ? "Unsaved changes" : "No unsaved changes"}</p>
          <div className="form-bar-actions">
            <button type="button" className="btn" disabled={!dirty || busy} onClick={() => { setForm(initial); setErrors({}); }}>Cancel</button>
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

// ---- Addresses: the fan's saved pickup contacts (Shopping's address book; this shop fulfils by QR pickup)

export function Addresses({ token }: { token: string }) {
  const load = useCallback(() => shop.pickupContacts(token), [token]);
  const { items, error, reload } = useList<PickupContact>(load);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const remove = async (c: PickupContact) => {
    setBusy(c.contactId);
    setFailed(null);
    try {
      await shop.deletePickupContact(token, c.contactId);
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
      <h2 id="account-panel-title">Addresses</h2>
      <p className="meta">Save the pickup contacts for your next order: who collects it, and the number we reach them on.</p>
      {failed ? <p className="field-error" role="alert"><Icon name="alert" />{failed}</p> : null}
      <ListState items={items} error={error} reload={reload} empty="No saved addresses yet.">
        {(list) => (
          <ul className="rows" role="list">
            {list.map((c) =>
              editing === c.contactId ? (
                <li key={c.contactId} className="row row-plain">
                  <ContactForm idPrefix={`c-${c.contactId}`} initial={c} onCancel={() => setEditing(null)} onSave={async (v) => { await shop.updatePickupContact(token, c.contactId, v); setEditing(null); reload(); }} />
                </li>
              ) : (
                <li key={c.contactId} className="row row-plain row-split">
                  <div className="row-text">
                    <p className="row-title">{c.name}</p>
                    <p className="meta">{c.phone}</p>
                  </div>
                  {confirming === c.contactId ? (
                    <div className="row-confirm" role="group" aria-label={`Delete ${c.name}?`}>
                      <span className="meta">Delete this address?</span>
                      <button className="btn" onClick={() => setConfirming(null)} disabled={busy === c.contactId}>Keep</button>
                      <button className="btn btn-danger" onClick={() => void remove(c)} disabled={busy === c.contactId}>{busy === c.contactId ? <span className="spinner" aria-hidden="true" /> : null}Delete</button>
                    </div>
                  ) : (
                    <div className="row-confirm">
                      <button className="btn" onClick={() => setEditing(c.contactId)} aria-label={`Edit ${c.name}`}>Edit</button>
                      <button className="btn" onClick={() => setConfirming(c.contactId)} aria-label={`Delete ${c.name}`}>Delete</button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </ListState>
      {editing === "new" ? (
        <div className="account-block">
          <h3>New address</h3>
          <ContactForm idPrefix="c-new" onCancel={() => setEditing(null)} onSave={async (v) => { await shop.addPickupContact(token, v); setEditing(null); reload(); }} />
        </div>
      ) : (
        <div><button className="btn btn-primary btn-lg" onClick={() => setEditing("new")}>Add address</button></div>
      )}
    </>
  );
}

function ContactForm({ idPrefix: id, initial, onSave, onCancel }: { idPrefix: string; initial?: { name: string; phone: string }; onSave: (v: { name: string; phone: string }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return setError("Enter a name and a phone number.");
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), phone: phone.trim() });
    } catch (err) {
      setError(problem(err));
      setBusy(false);
    }
  };
  return (
    <form className="account-form contact-form" onSubmit={submit} noValidate>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-name`}>Name</label>
          <input id={`${id}-name`} value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>Phone number</label>
          <input id={`${id}-phone`} value={phone} type="tel" autoComplete="tel" inputMode="tel" placeholder="+852 9123 4567" onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      {error ? <p className="field-error" role="alert"><Icon name="alert" />{error}</p> : null}
      <div className="form-bar-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" aria-hidden="true" /> : null}Save address</button>
      </div>
    </form>
  );
}

// ---- Payment methods: what this shop takes, and the one you prefer here (remembered per site)

export function Payments({ token }: { token: string }) {
  const load = useCallback(() => shop.paymentMethods(token), [token]);
  const { items, error, reload } = useList<PaymentMethod>(load);
  const [preferred, setPreferred] = useState<string | null>(null);
  useEffect(() => setPreferred(preferredPayment()), []);
  const choose = (code: string | null) => {
    setPreferredPayment(code);
    setPreferred(code);
  };
  return (
    <>
      <h2 id="account-panel-title">Payment methods</h2>
      <p className="meta">Pick how you like to pay on this site; checkout starts on it. Each artist site remembers its own choice.</p>
      <p className="note">Cards and wallets aren’t stored: you confirm each payment on the provider’s page.</p>
      <ListState items={items} error={error} reload={reload} empty="Add something to your bag to see the payment methods this shop takes for it.">
        {(list) => (
          <fieldset className="fieldset">
            <legend className="sr-only">Preferred payment method</legend>
            {list.map((m) => (
              <label key={m.methodCode} className="choice">
                <input type="radio" name="preferred" checked={preferred === m.methodCode} onChange={() => choose(m.methodCode)} />
                <span className="choice-text">
                  <span className="choice-title">{m.displayName}</span>
                  <span className="meta">{preferred === m.methodCode ? "Preferred on this site" : m.category.replaceAll("_", " ").toLowerCase()}</span>
                </span>
              </label>
            ))}
            {preferred ? <button type="button" className="btn btn-ghost choice-reset" onClick={() => choose(null)}>Forget my choice</button> : null}
          </fieldset>
        )}
      </ListState>
    </>
  );
}

// ---- Security & privacy: the state, changed on Ztor (like Google, a partner site manages none of it)

const PROVIDER = { google: "Google", apple: "Apple", facebook: "Facebook", line: "LINE" } as const;

export function Security({ me }: { me: AccountView }) {
  return (
    <>
      <h2 id="account-panel-title">Security & privacy</h2>
      <p className="meta">Your Ztor account protects every artist site at once, so its security lives on Ztor: password, two-step verification, sign-in methods, signed-in devices, the sites you’ve connected, and deleting your account.</p>
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
          Manage security on Ztor
          <Icon name="arrow-up-right" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <OnZtor page="connected">Connected sites and sign-ins</OnZtor>
      </div>
    </>
  );
}
