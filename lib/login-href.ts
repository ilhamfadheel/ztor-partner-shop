/** The login page, remembering where the fan was (same-origin path only; the login page re-checks). */
export const loginHref = (returnTo: string | null | undefined): string =>
  returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && returnTo !== "/login" ? `/login?return_to=${encodeURIComponent(returnTo)}` : "/login";
