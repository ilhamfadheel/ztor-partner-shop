/** Public configuration (NEXT_PUBLIC_*, inlined at build). No secrets: this site is a public OIDC client. */
export const config = {
  issuer: (process.env.NEXT_PUBLIC_ZTOR_ISSUER ?? "").replace(/\/+$/, ""),
  api: (process.env.NEXT_PUBLIC_ZTOR_API ?? "").replace(/\/+$/, ""),
  clientId: process.env.NEXT_PUBLIC_ZTOR_CLIENT_ID ?? "",
  /** Empty = the SSO issues no shop tokens yet; sign-in works, fan shop calls will 401. */
  shopResource: process.env.NEXT_PUBLIC_ZTOR_SHOP_RESOURCE || undefined,
  /** The optional sign-in buttons this platform turned on in the console (Sign-in buttons page), e.g. "apple,google,facebook,line". */
  providers: (process.env.NEXT_PUBLIC_ZTOR_PROVIDERS ?? "").split(",").map((p) => p.trim()).filter(Boolean),
  /** Shopping's media CDN: product images arrive as paths relative to it (e.g. "image/…/….png"). */
  media: (process.env.NEXT_PUBLIC_ZTOR_MEDIA || "https://d1k50uq0sig7az.cloudfront.net").replace(/\/+$/, ""),
};

/** The public Partner API reference this site is built from (the console, on the issuer's origin). */
export const docsUrl = (): string => (config.issuer ? `${new URL(config.issuer).origin}/docs` : "https://ztorpartners.tripcaststudio.com/docs");

/** The console serves the hosted sign-in buttons from its own origin (the issuer's host): {origin}/embed/v1/signin.{js,css}. */
export const embedBase = (): string => (config.issuer ? `${new URL(config.issuer).origin}/embed/v1` : "");

export const missingConfig = (): string[] =>
  (["issuer", "api", "clientId"] as const).filter((key) => !config[key]).map((key) => `NEXT_PUBLIC_ZTOR_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
