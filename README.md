# ztor-partner-shop

A partner (artist) shop built on **Ztor SSO Platforms**: fans sign in with **Continue with Ztor** and buy the creator's merch through Ztor's **Creator API**. Live at https://shop.ilhamfadhil.com.

Reference implementation of the two things a partner site integrates:

- **Sign in with Ztor** — OpenID Connect, authorization code + PKCE (S256), as a *public* client in the browser (no secret anywhere). `lib/oidc.ts`.
- **The shop** — `GET /creator/v1/*` through the Ztor gateway with `X-Channel-Key` (= the client id) and, on fan endpoints, the fan's access token minted for the Creator API (`resource`). `lib/shop.ts`.

Docs: https://ztorpartners.tripcaststudio.com/docs

## Run

```sh
pnpm install
cp .env.example .env.local   # fill in your platform's values from the console → Integration
pnpm dev                     # http://localhost:3000
pnpm test                    # the PKCE / JWT / return-path self-check
```

## Configuration (all public)

| Variable | What |
| --- | --- |
| `NEXT_PUBLIC_ZTOR_ISSUER` | OIDC issuer; authorize/token/end-session come from its discovery document |
| `NEXT_PUBLIC_ZTOR_API` | Ztor gateway origin + `/api`; the Creator API is `{API}/creator/v1/*` |
| `NEXT_PUBLIC_ZTOR_CLIENT_ID` | Your platform's client id, also the `X-Channel-Key` |
| `NEXT_PUBLIC_ZTOR_SHOP_RESOURCE` | RFC 8707 resource indicator of the Creator API (the SSO's `SSO_CREATOR_API_RESOURCE`, same literal). Empty = sign-in works, fan shop calls answer 401 |
| `NEXT_PUBLIC_ZTOR_MEDIA` | Optional. Shopping's media CDN; product images arrive as paths relative to it. Default `https://d1k50uq0sig7az.cloudfront.net` |

## Register the site in the SSO Platforms console → Site & URLs

| List | Value |
| --- | --- |
| Domains | `shop.ilhamfadhil.com` |
| Allowed origins | `https://shop.ilhamfadhil.com` · `http://localhost:3000` |
| Sign-in return URLs | `https://shop.ilhamfadhil.com/auth/callback` · `http://localhost:3000/auth/callback` |
| Sign-out return URLs | `https://shop.ilhamfadhil.com/` · `http://localhost:3000/` |
| Payment return URLs | `https://shop.ilhamfadhil.com/checkout/done` · `http://localhost:3000/checkout/done` |

## Pages

| Route | Who | Does |
| --- | --- | --- |
| `/` | public | Catalogue (server-rendered, channel key only) |
| `/products/[id]` | public | Detail; option chips → SKU → add to cart (asks for Ztor sign-in first) |
| `/auth/callback` | — | Sign-in return URL: state check, code exchange, session in `localStorage` |
| `/cart` | fan | Quantities, remove |
| `/checkout` | fan | Quote → pickup contact → payment method → submit (Idempotency-Key) → payment page |
| `/checkout/done` | fan | Payment return URL: polls the group result, pay again |
| `/orders`, `/orders/[id]` | fan | Paid orders through this site |

## Flow

1. **Sign in** — `signIn()` makes a PKCE verifier + state, keeps them in `sessionStorage`, and sends the fan to the authorize endpoint with `resource=<Creator API>`. The callback checks `state` (and `iss`), posts the code + verifier to the token endpoint (same `resource`), accepts the ID token on `iss`/`aud`/`exp` (received directly over TLS), and stores `{ accessToken, idToken, expiresAt, user }`.
2. **Shop** — every call sends `X-Channel-Key`; fan calls add `Authorization: Bearer <access token>`. The facade only returns this platform's creator's products, cart lines, groups and orders; anything foreign is a 404.
3. **Pay** — `POST /checkout` with `callback_url = https://shop.ilhamfadhil.com/checkout/done` (must be on the Payment return URLs list). The group id is saved before leaving; the return page polls `GET /checkout/{groupId}` until `SUCCEEDED` / `CANCELED` / `EXPIRED`.
4. **Sign out** — revokes this site's access token (RFC 7009) and clears the local session only. The fan stays signed in to Ztor and to other partner sites — signing out of one shop must not end the shared SSO session (it was signing people out of the partners console).

## Deploy

Vercel project `ztor-partner-shop`; the four `NEXT_PUBLIC_*` variables are set there. `shop.ilhamfadhil.com` is a `CNAME` to `cname.vercel-dns.com` at Cloudflare (DNS only).
