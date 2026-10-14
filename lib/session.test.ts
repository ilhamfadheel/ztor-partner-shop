import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

// The browser this module runs in: config (read at import), storage, events, fetch, Web Locks.
process.env.NEXT_PUBLIC_ZTOR_ISSUER = "https://sso.example/sso";
process.env.NEXT_PUBLIC_ZTOR_API = "https://api.example/api";
process.env.NEXT_PUBLIC_ZTOR_CLIENT_ID = "shop-1";
process.env.NEXT_PUBLIC_ZTOR_SHOP_RESOURCE = "https://api.example/api/creator";

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: new EventTarget(),
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});
/** Runs each lock holder in turn; `before` lets a test act as another tab that renewed first. */
let before: (() => void) | undefined;
let queue = Promise.resolve();
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: (_name: string, fn: () => Promise<unknown>) => {
        const run = queue.then(() => (before?.(), (before = undefined), fn()));
        queue = run.then(() => undefined, () => undefined);
        return run;
      },
    },
  },
});

type Answer = { status: number; body: unknown } | "offline";
let answer: Answer;
let refreshes: URLSearchParams[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (url.endsWith("/.well-known/openid-configuration")) return Response.json({ authorization_endpoint: "https://sso.example/sso/auth", token_endpoint: "https://api.example/api/oidc/token" });
  refreshes.push(new URLSearchParams(String(init?.body)));
  if (answer === "offline") throw new TypeError("Failed to fetch");
  return Response.json(answer.body, { status: answer.status });
}) as typeof fetch;

const { currentSession, getSession } = await import("./oidc.ts");

const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const idToken = (name: string) => jwt({ iss: "https://sso.example/sso", aud: "shop-1", exp: Math.floor(Date.now() / 1000) + 3600, sub: "u-1", name });
const saved = (session: object) => store.set("ztor_session", JSON.stringify(session));
const stored = () => JSON.parse(store.get("ztor_session") ?? "null");
/** `null` = a session from before this site asked for a refresh token. */
const signedIn = (expiresIn: number, refreshToken: string | null = "rt-1") =>
  saved({ accessToken: "at-1", idToken: idToken("Fan"), ...(refreshToken ? { refreshToken } : {}), expiresAt: Date.now() + expiresIn, user: { sub: "u-1", name: "Fan" } });
const renewed = { status: 200, body: { access_token: "at-2", refresh_token: "rt-2", id_token: idToken("Fan Renamed"), expires_in: 3600, token_type: "Bearer" } };

beforeEach(() => {
  store.clear();
  refreshes = [];
  answer = renewed;
});

test("a session with more than a minute left is used as it is", async () => {
  signedIn(10 * 60_000);
  assert.equal((await currentSession())?.accessToken, "at-1");
  assert.equal(refreshes.length, 0);
});

test("a token about to run out is renewed with the refresh token, for the shop, and the rotated refresh token is kept", async () => {
  signedIn(30_000);
  const s = await currentSession();
  assert.equal(s?.accessToken, "at-2");
  assert.equal(s?.refreshToken, "rt-2");
  assert.equal(s?.user.name, "Fan Renamed");
  assert.ok(s && s.expiresAt > Date.now() + 59 * 60_000);
  assert.deepEqual(Object.fromEntries(refreshes[0]), { grant_type: "refresh_token", client_id: "shop-1", refresh_token: "rt-1", resource: "https://api.example/api/creator" });
  assert.equal(stored().refreshToken, "rt-2");
  // …and an expired one too: the fan stays signed in.
  signedIn(-5 * 60_000, "rt-2");
  assert.equal((await currentSession())?.accessToken, "at-2");
});

test("renews once for everything asking at the same time, and not again when another tab already did", async () => {
  signedIn(-1);
  const [a, b] = await Promise.all([currentSession(), currentSession()]);
  assert.equal(refreshes.length, 1); // a second use of rt-1 would sign the fan out
  assert.equal(a?.accessToken, "at-2");
  assert.equal(b?.accessToken, "at-2");

  signedIn(-1, "rt-2");
  before = () => saved({ ...stored(), accessToken: "at-other-tab", refreshToken: "rt-3", expiresAt: Date.now() + 3600_000 });
  assert.equal((await currentSession())?.accessToken, "at-other-tab");
  assert.equal(refreshes.length, 1);
});

test("a refused refresh signs the fan out", async () => {
  signedIn(-1);
  answer = { status: 400, body: { error: "invalid_grant", error_description: "grant request is invalid" } };
  assert.equal(await currentSession(), null);
  assert.equal(stored(), null);
});

test("offline, or Ztor failing, keeps the refresh token for the next try", async () => {
  signedIn(-1);
  answer = "offline";
  assert.equal(await currentSession(), null);
  assert.equal(stored().refreshToken, "rt-1");
  answer = { status: 503, body: {} };
  assert.equal(await currentSession(), null);
  assert.equal(stored().refreshToken, "rt-1");
  answer = renewed;
  assert.equal((await currentSession())?.accessToken, "at-2");
});

test("without a refresh token (signed in before this site asked for one), the session lasts until its token runs out", async () => {
  signedIn(30_000, null);
  assert.equal((await currentSession())?.accessToken, "at-1");
  signedIn(-1, null);
  assert.equal(await currentSession(), null);
  assert.equal(getSession(), null);
  assert.equal(refreshes.length, 0);
});
