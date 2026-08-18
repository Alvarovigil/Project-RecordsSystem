import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Admin pages are always rendered per-request: they must never be cached,
 * and each one checks the password cookie itself.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
