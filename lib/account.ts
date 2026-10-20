/**
 * The fan's Ztor account (docs → Fan account), called from the browser with the fan token this site
 * already holds. Like Google's sign-in, a partner site may only read the account and edit the profile
 * (display name, bio, avatar, default language); email, password, 2FA, sign-in methods, connected sites, sessions and deletion are
 * managed by the fan on Ztor, so this site links to Ztor's account settings for those (hostedSettings).
 * Envelope: `{ code, msg, data }`, code 200 = success; errors carry `data.reason` (+ `data.fields`).
 */
import { config } from "./config.ts";

export type AccountView = {
  userId: string;
  email: string | null;
  pendingEmail: string | null;
  phone: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** The fan's default language on Ztor; null when they never chose one. */
  language: ProfileLanguage | null;
  createdAt: string | null;
  mfa: { totp: boolean; recoveryCodesRemaining: number };
  linkedProviders: { provider: "google" | "facebook" | "apple" | "line"; email: string | null; linkedAt: string | null }[];
  hasPassword: boolean;
  deletion: { effectiveAt: string } | null;
};

/** The languages a fan can pick as their default (docs → Update profile). */
export const PROFILE_LANGUAGES = [
  { code: "en-us", label: "English" },
  { code: "zh-hk", label: "繁體中文（香港）" },
  { code: "zh-cn", label: "简体中文" },
] as const;
export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number]["code"];
export const BIO_MAX = 150;
/** Profile pictures are JPG/JPEG or PNG; Ztor refuses GIFs (docs → Avatar upload URL). */
export const AVATAR_TYPES = ["image/jpeg", "image/png"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** The profile fields a partner site may change; send only the ones that changed. */
export type ProfilePatch = { name?: string; bio?: string | null; avatarUrl?: string | null; language?: ProfileLanguage };
type AvatarUpload = { uploadUrl: string; publicUrl: string; expiresIn: number; method: "PUT"; headers: Record<string, string> };

export class AccountError extends Error {
  reason: string;
  fields?: Record<string, string>;
  constructor(reason: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.reason = reason;
    this.fields = fields;
  }
}

type Envelope<T> = { code: number; msg: string; data: T };

async function call<T>(token: string, path: string, init: { method?: "GET" | "PATCH" | "POST"; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  // The documented server is `{API}` and every account path starts with /api/v1/account.
  const res = await fetch(`${config.api}/api/v1/account${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (body && body.code === 200) return body.data;
  const data = (body?.data ?? null) as { reason?: string; message?: string; fields?: Record<string, string> } | null;
  // The gateway's own refusal ({ code: 401, msg: "token失效" }) has no reason: the route isn't open to this site.
  if (!data || Array.isArray(data) || !data.reason) throw new AccountError("UNAVAILABLE", `Ztor's account service isn't open to this site (HTTP ${res.status}${body ? `, code ${body.code}` : ""}).`);
  throw new AccountError(data.reason, data.message || body?.msg || `The account service refused the request (HTTP ${res.status}).`, data.fields);
}

export const account = {
  get: (token: string) => call<AccountView>(token, ""),
  update: (token: string, patch: ProfilePatch) => call<AccountView>(token, "", { method: "PATCH", body: patch }),
  /**
   * A new avatar, the documented three steps: an upload URL for the file's type, the file PUT
   * straight to the image store with exactly that Content-Type, then its publicUrl saved.
   */
  async uploadAvatar(token: string, file: File): Promise<AccountView> {
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) throw new AccountError("VALIDATION", "Use a JPG or PNG picture.");
    if (file.size > AVATAR_MAX_BYTES) throw new AccountError("VALIDATION", "Use a picture up to 5 MB.");
    const upload = await call<AvatarUpload>(token, "/avatar/upload-url", { method: "POST", body: { contentType: file.type } });
    const put = await fetch(upload.uploadUrl, { method: upload.method ?? "PUT", headers: upload.headers ?? { "Content-Type": file.type }, body: file });
    if (!put.ok) throw new AccountError("UPLOAD_FAILED", `The picture didn't upload (HTTP ${put.status}). Try again.`);
    return this.update(token, { avatarUrl: upload.publicUrl });
  },
};

/** Ztor's own account settings (the SSO Platforms console, on the issuer's origin): email, password, 2FA, sign-ins, deletion. */
export const hostedSettings = (page: "security" | "connected" = "security"): string =>
  config.issuer ? `${new URL(config.issuer).origin}/settings/account/${page}` : "";

