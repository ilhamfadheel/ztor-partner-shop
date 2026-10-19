/**
 * The request's language, on the server: the fan's saved choice (the cookie /account and the
 * sign-in callback keep in step with their Ztor profile), else the browser's Accept-Language,
 * else English. Client components get the same value from <LangProvider> instead.
 */
import { cookies, headers } from "next/headers";
import { asLang, FALLBACK_LANG, LANG_COOKIE, langFromAcceptLanguage, type Lang } from "./i18n.ts";

export async function resolveLang(): Promise<Lang> {
  const saved = asLang((await cookies()).get(LANG_COOKIE)?.value);
  return saved ?? langFromAcceptLanguage((await headers()).get("accept-language")) ?? FALLBACK_LANG;
}
