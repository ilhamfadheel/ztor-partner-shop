// A minimal browser for the LLOUD adapters under node --test: storage, events, Web Locks, fetch,
// and the /lloud-config.js module the adapters import (served by app/lloud-config.js/route.ts).
import { registerHooks } from "node:module";

export const store = new Map();
export const config = { issuer: "https://sso.example/sso", api: "https://api.example/api", clientId: "shop-1", shopResource: "https://api.example/api/creator", media: "https://cdn.example" };

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "/lloud-config.js") return { url: "data:text/javascript,export default " + encodeURIComponent(JSON.stringify(config)), shortCircuit: true };
    return next(spec, ctx);
  },
});

const events = new EventTarget();
Object.assign(globalThis, {
  window: events,
  document: events,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: "https://shop.example/fan-club", origin: "https://shop.example", pathname: "/fan-club", search: "", hash: "", assign(url) { this.assigned = url; } },
  CustomEvent: class extends Event { constructor(type, init) { super(type); this.detail = init?.detail; } },
});
let queue = Promise.resolve();
export const locks = { before: undefined };
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: (_name, fn) => {
        const run = queue.then(() => (locks.before?.(), (locks.before = undefined), fn()));
        queue = run.then(() => undefined, () => undefined);
        return run;
      },
    },
  },
});

/** Route table for fetch: [method, url-prefix] → (url, init) => Response. Unmatched calls throw. */
export const routes = [];
export const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? "GET";
  calls.push({ url: String(url), method, headers: init.headers ?? {}, body: init.body });
  if (String(url).endsWith("/.well-known/openid-configuration")) return Response.json({ authorization_endpoint: "https://sso.example/sso/auth", token_endpoint: "https://sso.example/sso/token", revocation_endpoint: "https://sso.example/sso/revoke" });
  const hit = routes.find(([m, prefix]) => m === method && String(url).startsWith(prefix));
  if (!hit) throw new Error(`unrouted ${method} ${url}`);
  return hit[2](String(url), init);
};

export const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
export const idToken = (name = "Fan", sub = "u-1") => jwt({ iss: config.issuer, aud: config.clientId, exp: Math.floor(Date.now() / 1000) + 3600, sub, name });
export const signIn = (expiresIn = 10 * 60_000, refreshToken = "rt-1", sub = "u-1") =>
  store.set("ztor_session", JSON.stringify({ accessToken: "at-1", idToken: idToken("Fan", sub), ...(refreshToken ? { refreshToken } : {}), expiresAt: Date.now() + expiresIn, user: { sub, name: "Fan" } }));
export function reset() {
  store.clear();
  routes.length = 0;
  calls.length = 0;
}
