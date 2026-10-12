import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your account" };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
