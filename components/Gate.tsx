"use client";
import type { ReactNode } from "react";
import { signIn, type Session } from "@/lib/oidc";
import { useSession } from "./Header";

/** Renders `children` with the fan's session, or the "Continue with Ztor" prompt. */
export function Gate({ children }: { children: (session: Session) => ReactNode }) {
  const session = useSession();
  if (session === undefined) return <p className="muted">Loading…</p>;
  if (!session) return <SignInPrompt />;
  return <>{children(session)}</>;
}

export function SignInPrompt({ text = "Sign in with your Ztor account to continue." }: { text?: string }) {
  return (
    <div className="notice" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <span>{text}</span>
      <button className="btn btn-primary" data-ztor-signin onClick={() => void signIn()}>Continue with Ztor</button>
    </div>
  );
}
