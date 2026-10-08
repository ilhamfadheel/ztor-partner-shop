"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      <div className="notice error" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <span>Sign-in didn’t finish: {error}</span>
        <button className="btn" onClick={() => void signIn("/")}>Try again</button>
      </div>
    );
  return <p className="muted">Signing you in…</p>;
}
