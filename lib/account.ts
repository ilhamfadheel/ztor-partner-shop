/**
 * The fan's Ztor account (docs → Fan account), called from the browser with the fan token this site
 * already holds. Partner sites may read the account, change the display name, and manage connected
 * platforms, sessions and consents; email, password, 2FA, sign-in links and deletion are Ztor's own,
 * so this site links to Ztor's account settings for those (hostedSettings).
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
  createdAt: string | null;
  mfa: { totp: boolean; recoveryCodesRemaining: number };
  linkedProviders: { provider: "google" | "facebook" | "apple" | "line"; email: string | null; linkedAt: string | null }[];
  hasPassword: boolean;
  deletion: { effectiveAt: string } | null;
};
export type ConnectedPlatform = { clientId: string; name: string; logoUrl: string | null; scopes: string[]; firstSignedInAt: string; lastSignedInAt: string };
export type SessionView = { id: string; current: boolean; userAgent: string | null; ip: string | null; createdAt: string; lastActiveAt: string };
export type ConsentRecord = { document: string; version: string; acceptedAt: string; clientId: string | null };

export class AccountError extends Error {
  constructor(
    public reason: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Envelope<T> = { code: number; msg: string; data: T };

async function call<T>(token: string, path: string, init: { method?: "GET" | "PATCH" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
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
  rename: (token: string, name: string) => call<AccountView>(token, "", { method: "PATCH", body: { name } }),
  consents: (token: string) => call<ConsentRecord[]>(token, "/consents"),
  platforms: (token: string) => call<ConnectedPlatform[]>(token, "/platforms"),
  disconnect: (token: string, clientId: string) => call<object>(token, `/platforms/${encodeURIComponent(clientId)}`, { method: "DELETE" }),
  sessions: (token: string) => call<SessionView[]>(token, "/sessions"),
  revokeSession: (token: string, id: string) => call<object>(token, `/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  revokeAll: (token: string) => call<object>(token, "/sessions/revoke-all", { method: "POST" }),
};

/** Ztor's own account settings (the SSO Platforms console, on the issuer's origin): email, password, 2FA, sign-ins, deletion. */
export const hostedSettings = (page: "security" | "connected" = "security"): string =>
  config.issuer ? `${new URL(config.issuer).origin}/settings/account/${page}` : "";

/** "Chrome on macOS" from a user agent: enough to tell a fan's devices apart, nothing more. */
export function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /OPR\/|Opera/.test(userAgent) ? "Opera" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Mac OS X/.test(userAgent) ? "macOS" : /Windows/.test(userAgent) ? "Windows" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
