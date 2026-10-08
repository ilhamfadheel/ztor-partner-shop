"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/oidc";
import { loginHref } from "@/lib/login-href";
import { useSession } from "./Header";
import { Loading, LinesSkeleton } from "./Skeletons";
import { StateMessage } from "./StateMessage";

/**
 * Renders `children` with the fan's session, or the "Continue with Ztor" prompt.
 * `fallback` should be the page's own skeleton so the session check and the data load share one placeholder.
 */
export function Gate({ children, title, fallback }: { children: (session: Session) => ReactNode; title?: string; fallback?: ReactNode }) {
  const session = useSession();
  if (session === undefined) return fallback ?? <Loading label="Loading…"><LinesSkeleton rows={2} /></Loading>;
  if (!session) return <SignInPrompt title={title} />;
  return <>{children(session)}</>;
}

export function SignInPrompt({ title = "Sign in to continue", text = "Use your Ztor account — the same one works on every artist site." }: { title?: string; text?: string }) {
  const pathname = usePathname();
  return (
    <StateMessage
      tone="accent"
      icon="user"
      title={title}
      actions={<Link href={loginHref(pathname)} className="btn btn-primary btn-lg" data-ztor-signin>Continue with Ztor</Link>}
    >
      <p>{text}</p>
    </StateMessage>
  );
}
