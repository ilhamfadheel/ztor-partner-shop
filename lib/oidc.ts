/**
 * "Continue with Ztor": OpenID Connect authorization-code flow with PKCE (S256), as a public
 * client in the browser. Endpoints come from the issuer's discovery document; the access token is
 * minted for the Creator API (`resource`) so it works on the shop endpoints; the ID token's claims
 * are the fan's profile. Received straight from the token endpoint over TLS, so the ID token is
 * checked on iss/aud/exp (OIDC Core §3.1.3.7 step 6), not re-verified against the JWKS.
 */
import { config } from "./config.ts";

export type Session = {
  accessToken: string;
  idToken: string;
  /** Epoch ms. */
  expiresAt: number;
  user: { sub: string; name?: string; email?: string };
};

type Discovery = { authorization_endpoint: string; token_endpoint: string; revocation_endpoint?: string };

const SIGNIN_KEY = "ztor_signin";
const SESSION_KEY = "ztor_session";
const SCOPE = "openid email profile";

export const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** PKCE: a random verifier and its S256 challenge. */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

let discovery: Promise<Discovery> | undefined;
export function discover(): Promise<Discovery> {
  discovery ??= fetch(`${config.issuer}/.well-known/openid-configuration`).then((r) => {
    if (!r.ok) throw new Error(`Discovery failed (HTTP ${r.status})`);
    return r.json() as Promise<Discovery>;
  });
  return discovery;
}

export const redirectUri = () => `${location.origin}/auth/callback`;

/** Only same-origin paths may be used as a return target. */
export const safePath = (value: string | null | undefined): string =>
  value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";

/** Starts the sign-in: stores verifier + state, then sends the browser to Ztor. `idp` skips the chooser. */
export async function signIn(returnTo = location.pathname + location.search, idp?: string): Promise<void> {
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(SIGNIN_KEY, JSON.stringify({ verifier, state, returnTo: safePath(returnTo) }));
  const url = new URL((await discover()).authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    ...(config.shopResource ? { resource: config.shopResource } : {}),
    ...(idp ? { ztor_idp: idp } : {}),
  }).toString();
  location.assign(url);
}

/** Decodes a JWT payload without verifying it (see the module note for why that is enough here). */
export function claims(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(part.length + ((4 - (part.length % 4)) % 4), "="));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
}

/** The callback page: checks state, exchanges the code, stores the session. Returns where to go next. */
export async function completeSignIn(params: URLSearchParams): Promise<string> {
  const pending = JSON.parse(sessionStorage.getItem(SIGNIN_KEY) ?? "null") as { verifier: string; state: string; returnTo: string } | null;
  sessionStorage.removeItem(SIGNIN_KEY);
  if (params.get("error")) throw new Error(params.get("error_description") || params.get("error")!);
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) throw new Error("Sign-in state mismatch. Please try again.");
  const iss = params.get("iss");
  if (iss && iss !== config.issuer) throw new Error("Unexpected issuer.");
  const response = await fetch((await discover()).token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
      ...(config.shopResource ? { resource: config.shopResource } : {}),
    }),
  });
  const token = (await response.json().catch(() => ({}))) as { access_token?: string; id_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !token.access_token || !token.id_token) throw new Error(token.error_description || token.error || `Token exchange failed (HTTP ${response.status})`);
  const id = claims(token.id_token);
  if (id.iss !== config.issuer || id.aud !== config.clientId || typeof id.exp !== "number" || id.exp * 1000 < Date.now()) throw new Error("ID token rejected.");
  const session: Session = {
    accessToken: token.access_token,
    idToken: token.id_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    user: { sub: String(id.sub), name: typeof id.name === "string" ? id.name : undefined, email: typeof id.email === "string" ? id.email : undefined },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("ztor-session"));
  return pending.returnTo;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    return session && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("ztor-session"));
}

/**
 * Signs out of THIS site only: revokes our access token at Ztor and clears the local session.
 * The fan's Ztor session — and every other site they signed in to with it — stays signed in,
 * the way signing out of one app does not sign you out of Google. (RP-initiated logout via the
 * end-session endpoint would end the shared SSO session, which took partners' consoles down too.)
 */
export async function signOut(): Promise<void> {
  const session = getSession();
  clearSession();
  if (session) {
    try {
      const { revocation_endpoint } = await discover();
      if (revocation_endpoint) {
        await fetch(revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: session.accessToken, token_type_hint: "access_token", client_id: config.clientId }),
        });
      }
    } catch {
      // Best effort: the token dies at expiry anyway; the local session is already gone.
    }
  }
  location.assign("/");
}
