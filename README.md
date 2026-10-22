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
| `LLOUD_MEDIA_ORIGIN` | Optional, build time. Where the runway's films (`/assets/fashion/*`, Git LFS in LLOUD's repo, ~430 MB) are served from. Default `https://lloud.club` |

## Register the site in the SSO Platforms console → Site & URLs

| List | Value |
| --- | --- |
| Domains | `shop.ilhamfadhil.com` |
| Allowed origins | `https://shop.ilhamfadhil.com` · `http://localhost:3000` |
| Sign-in return URLs | `https://shop.ilhamfadhil.com/auth/callback` · `http://localhost:3000/auth/callback` |
| Sign-out return URLs | `https://shop.ilhamfadhil.com/` · `http://localhost:3000/` |
| Payment return URLs | `https://shop.ilhamfadhil.com/checkout/done` · `http://localhost:3000/checkout/done` |

## Pages

The fan-facing site is **LLOUD's own** (github `codeL1985/lloud-club`, Asana 1219623889042756): its static HTML, CSS and ES modules under `public/`, served at clean URLs (`next.config.ts`), with its preview data stores swapped for Ztor (`public/js/ztor/`). Pages with nothing behind them in Ztor yet stay static.

| Route | Who | Does |
| --- | --- | --- |
| `/` | public | LLOUD's runway (static; the films stream from lloud.club, `LLOUD_MEDIA_ORIGIN`) |
| `/fan-club` (`/loyalty`) | public / fan | Fan pass, tier, rank, gap to the next tier, next unlock — `/creator/v1/loyalty/me` |
| `/rewards` | public / fan | The Media Vault: rewards with their unlock steps; opening one fetches a short-lived media link — `/creator/v1/vault/*` |
| `/leaderboard` | public | The artist's fan board (public names) — `/creator/v1/loyalty/board` |
| `/shop`, `/product?id=` | public | The creator's products; options → SKU → add to bag (asks for Ztor sign-in first) |
| `/checkout` | fan | Quote → pickup contact → payment method → submit (Idempotency-Key) → payment page |
| `/account`, `/edit-profile` | fan | Pass, orders, points; name, bio and photo on the fan's Ztor account |
| `/signup` | public | Continue with Ztor (the hosted sign-in) |
| `/auction` | public | LLOUD's auction room (static: no auction service in Ztor yet) |
| `/login`, `/auth/callback` | — | Hosted sign-in buttons; sign-in return URL: state check, code exchange, session in `localStorage` |
| `/checkout/done` | fan | Payment return URL: polls the group result, pay again |
| `/orders`, `/orders/[id]`, `/notifications` | fan | Order detail (pickup QR codes) and order notifications |

Clean URLs only (`/rewards`, `/product?id=…`); an old `.html` address redirects (308) to it. Moving between the club's pages (Fan Club, Rewards, Shop, Leaderboard, Auction, Account, Sign-up) happens in place, like a Next.js app's navigation (`public/js/club-routes.js` + `go()` in `club.js`: history, the nav, the view), and what a page loaded is kept for the tab (`sessionStorage`, per fan) so the next page — or a full load of the runway/product/checkout and back — renders at once and refreshes in the background.

LLOUD's modules read synchronously (`member()`, `rewardCatalog()`, `cart.getItems()`…), so `public/js/ztor/state.js` loads what a page needs from the Creator API before it renders and holds it in memory; changes go to the API and the page is told with the events LLOUD already listens to (`member:change`, `cart:change`). `public/js/ztor/session.js` shares the React pages' sign-in (`localStorage.ztor_session`) and renews it the same way `lib/oidc.ts` does. Public config reaches the static files as `/lloud-config.js`. Tests: `pnpm test` (`test/lloud/*.test.mjs`).

## Flow

1. **Sign in** — `signIn()` makes a PKCE verifier + state, keeps them in `sessionStorage`, and sends the fan to the authorize endpoint with `resource=<Creator API>`. The callback checks `state` (and `iss`), posts the code + verifier to the token endpoint (same `resource`), accepts the ID token on `iss`/`aud`/`exp` (received directly over TLS), and stores `{ accessToken, idToken, expiresAt, user }`.
2. **Shop** — every call sends `X-Channel-Key`; fan calls add `Authorization: Bearer <access token>`. The facade only returns this platform's creator's products, cart lines, groups and orders; anything foreign is a 404.
3. **Pay** — `POST /checkout` with `callback_url = https://shop.ilhamfadhil.com/checkout/done` (must be on the Payment return URLs list). The group id is saved before leaving; the return page polls `GET /checkout/{groupId}` until `SUCCEEDED` / `CANCELED` / `EXPIRED`.
4. **Sign out** — revokes this site's access token (RFC 7009) and clears the local session only. The fan stays signed in to Ztor and to other partner sites — signing out of one shop must not end the shared SSO session (it was signing people out of the partners console).

## Fan account

Like Google's sign-in, a partner site only reads the fan's Ztor account and changes the display name (`lib/account.ts`, docs → *Fan account*: `GET`/`PATCH /api/v1/account`, Ztor_backend #751/#752). Password, 2FA, sign-in methods, devices, connected sites and deletion are managed on Ztor, so `/account` links to `<issuer origin>/settings/account/security`. Addresses are the fan's saved pickup contacts through the Creator API (`/creator/v1/pickup-contacts`, change/delete in Ztor_backend #759/#760); payment methods are what the shop takes for the bag, with the fan's preferred one remembered per site in the browser (`lib/preferences.ts`) and preselected at checkout. Shopping stores no cards.

## Design

lloud.club's fan-club style: warm paper, ink, hairlines, square corners, Satoshi. Tokens in `app/globals.css`, rationale in `design-system/ztor-partner-shop/MASTER.md`.

## Deploy

Vercel project `ztor-partner-shop`; the four `NEXT_PUBLIC_*` variables are set there. `shop.ilhamfadhil.com` is a `CNAME` to `cname.vercel-dns.com` at Cloudflare (DNS only).
