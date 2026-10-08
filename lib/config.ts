/** Public configuration (NEXT_PUBLIC_*, inlined at build). No secrets: this site is a public OIDC client. */
export const config = {
  issuer: (process.env.NEXT_PUBLIC_ZTOR_ISSUER ?? "").replace(/\/+$/, ""),
  api: (process.env.NEXT_PUBLIC_ZTOR_API ?? "").replace(/\/+$/, ""),
  clientId: process.env.NEXT_PUBLIC_ZTOR_CLIENT_ID ?? "",
  /** Empty = the SSO issues no shop tokens yet; sign-in works, fan shop calls will 401. */
  shopResource: process.env.NEXT_PUBLIC_ZTOR_SHOP_RESOURCE || undefined,
};

export const missingConfig = (): string[] =>
  (["issuer", "api", "clientId"] as const).filter((key) => !config[key]).map((key) => `NEXT_PUBLIC_ZTOR_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
