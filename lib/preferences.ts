/**
 * The fan's preferred payment method on THIS site: kept in the browser per platform (client id),
 * so each artist site remembers its own choice, and checkout starts on it when the shop offers it.
 */
import { config } from "./config.ts";

const key = () => `ztor.preferred_payment:${config.clientId}`;

export function preferredPayment(): string | null {
  try {
    return localStorage.getItem(key());
  } catch {
    return null;
  }
}

export function setPreferredPayment(methodCode: string | null): void {
  try {
    if (methodCode) localStorage.setItem(key(), methodCode);
    else localStorage.removeItem(key());
  } catch {
    // Private mode / storage off: the choice just isn't remembered.
  }
}
