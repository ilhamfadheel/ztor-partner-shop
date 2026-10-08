"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { StateMessage } from "@/components/StateMessage";
import { completeSignIn, signIn } from "@/lib/oidc";

/** The registered sign-in return URL: exchanges the code, then goes back to where the fan was. */
export default function Callback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    completeSignIn(new URLSearchParams(location.search))
      .then((returnTo) => router.replace(returnTo))
      .catch((e: Error) => setError(e.message));
  }, [router]);
  if (error)
    return (
      <StateMessage
        tone="error"
        heading="h1"
        title="Sign-in didn’t finish"
        actions={
          <>
            <button className="btn btn-primary" onClick={() => void signIn("/")}>
              <Icon name="refresh" />
              Try again
            </button>
            <Link href="/" className="btn">Back to the shop</Link>
          </>
        }
      >
        <p>Your Ztor account is fine — this site just didn’t get the sign-in back.</p>
        <p className="state-detail">{error}</p>
      </StateMessage>
    );
  return <StateMessage live heading="h1" tone="info" icon="spinner" title="Signing you in…" />;
}
