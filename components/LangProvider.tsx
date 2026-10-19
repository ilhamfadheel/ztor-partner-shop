"use client";
import { createContext, useContext, type ReactNode } from "react";
import { dict, FALLBACK_LANG, type Lang, type Messages } from "@/lib/i18n";

/** The layout resolves the request's language once (lib/lang.ts); every client component reads it here. */
const LangContext = createContext<Lang>(FALLBACK_LANG);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);
export const useT = (): Messages => dict(useContext(LangContext));
