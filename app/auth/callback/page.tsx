"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { StateMessage } from "@/components/StateMessage";
import { account } from "@/lib/account";
import { asLang, readLangCookie, storeLangCookie } from "@/lib/i18n";
import { completeSignIn, getSession, signIn } from "@/lib/oidc";

/** The registered sign-in return URL: exchanges the code, then goes back to where the fan was. */
export default function Callback() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    completeSignIn(new URLSearchParams(location.search))
      .then(async (returnTo) => {
        // The fan's saved language follows them to this device: read it once, best-effort — the
        // sign-in still lands even when the account service doesn't answer.
        const token = getSession()?.accessToken;
        const saved = token ? asLang(await account.get(token).then((me) => me.language).catch(() => null)) : null;
        if (saved && saved !== readLangCookie()) {
          storeLangCookie(saved);
          location.replace(returnTo); // a fresh load, so the whole site arrives in the saved language
          return;
        }
        router.replace(returnTo);
      })
      .catch((e: Error) => setError(e.message));
  }, [router]);
  if (error)
    return (
      <StateMessage
        tone="error"
        heading="h1"
        title={t.callback.didntFinish}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => void signIn("/")}>
              <Icon name="refresh" />
              {t.common.tryAgain}
            </button>
            <a href="/shop" className="btn">{t.common.backToShop}</a>
          </>
        }
      >
        <p>{t.callback.accountFine}</p>
        <p className="state-detail">{error}</p>
      </StateMessage>
    );
  return <StateMessage live heading="h1" tone="info" icon="spinner" title={t.callback.signingIn} />;
}
