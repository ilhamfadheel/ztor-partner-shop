import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  /** error = announced as an alert; success/accent tint the icon; empty/info stay neutral. */
  tone?: "empty" | "info" | "error" | "success" | "accent";
  icon?: IconName | "spinner";
  /** Use h1 when the panel is the whole page (callback, 404). */
  heading?: "h1" | "h2";
  /** Announce changes politely (progress that updates in place). */
  live?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
};

/** The one panel for empty, error, sign-in and progress states: icon, what happened, what to do next. */
export function StateMessage({ title, tone = "empty", icon, heading: Heading = "h2", live, actions, children }: Props) {
  const glyph = icon ?? (tone === "error" ? "alert" : tone === "success" ? "check-circle" : null);
  return (
    <section className="state" data-tone={tone} role={tone === "error" ? "alert" : live ? "status" : undefined}>
      {glyph ? <span className="state-icon">{glyph === "spinner" ? <span className="spinner spinner-lg" aria-hidden="true" /> : <Icon name={glyph} size="lg" />}</span> : null}
      <Heading>{title}</Heading>
      {children ? <div className="state-body">{children}</div> : null}
      {actions ? <div className="state-actions">{actions}</div> : null}
    </section>
  );
}
