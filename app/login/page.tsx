"use client";
import Link from "next/link";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "@/components/Header";
import { StateMessage } from "@/components/StateMessage";
import { config, embedBase } from "@/lib/config";
import { rememberReturnTo, safePath, signIn } from "@/lib/oidc";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

/**
 * The dedicated sign-in page: Ztor's hosted buttons (the console's embed — "Continue with Ztor" plus
 * every provider this platform turned on), loaded from the console's origin so a change there reaches
 * this page without a deploy. The embed runs the PKCE sign-in itself and comes back to /auth/callback
 * with code + state; `data-resource` makes the token good for the shop API. Until the script arrives
 * (or if it can't) the page's own button does the same sign-in through lib/oidc.
 */
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const returnTo = safePath(params.get("return_to"));
  const [origin, setOrigin] = useState<string | null>(null);
  const [embed, setEmbed] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    rememberReturnTo(returnTo);
    setOrigin(location.origin);
  }, [returnTo]);
  useEffect(() => {
    if (session) router.replace(returnTo === "/login" ? "/" : returnTo);
  }, [session, returnTo, router]);

  const base = embedBase();
  return (
    <div className="login">
      {base ? <link rel="stylesheet" href={`${base}/signin.css`} /> : null}
      <StateMessage heading="h1" tone="accent" icon="user" title="Sign in">
        <p>Use your Ztor account — the same one works on every artist site.</p>
        {origin && base ? (
          <div
            className="ztor-signin login-buttons"
            data-client-id={config.clientId}
            data-redirect-uri={`${origin}/auth/callback`}
            data-providers={config.providers.join(",") || undefined}
            data-resource={config.shopResource}
            data-lang="en-us"
            aria-busy={embed === "loading"}
          />
        ) : null}
        {embed !== "ready" ? (
          <p className="login-fallback">
            <button className="btn btn-primary btn-lg" data-ztor-signin onClick={() => void signIn(returnTo)}>
              Continue with Ztor
            </button>
          </p>
        ) : null}
        <p className="meta">
          By continuing you agree to Ztor’s terms. <Link href="/" className="link">Back to the shop</Link>
        </p>
      </StateMessage>
      {origin && base ? (
        <Script
          src={`${base}/signin.js`}
          strategy="afterInteractive"
          onLoad={() => {
            window.ZtorSignIn?.render();
            setEmbed(document.querySelector(".ztor-signin__btn") ? "ready" : "failed");
          }}
          onError={() => setEmbed("failed")}
        />
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    ZtorSignIn?: { render: (element?: Element) => void };
  }
}
