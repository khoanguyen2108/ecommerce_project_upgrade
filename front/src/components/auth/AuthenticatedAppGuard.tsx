"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

const PUBLIC_ROUTES = new Set([
  "/",
  "/intro",
  "/login",
  "/register",
  "/forgot-password",
  "/auth/success",
  "/auth/failure",
]);
const PUBLIC_CATALOG_PREFIXES = ["/products", "/categories"];
const PUBLIC_FEATURE_ROUTES = new Set(["/ai/style-assistant"]);

export function AuthenticatedAppGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthSession();
  const isPublicRoute =
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_FEATURE_ROUTES.has(pathname) ||
    PUBLIC_CATALOG_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  useEffect(() => {
    if (isLoading || isAuthenticated || isPublicRoute) return;

    const returnPath = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
  }, [isAuthenticated, isLoading, isPublicRoute, router]);

  if (isPublicRoute) return <>{children}</>;
  if (isAuthenticated) return <>{children}</>;

  return (
    <main className="account-state-page">
      <section
        aria-labelledby="session-check-heading"
        className="account-state account-state--loading"
        role="status"
      >
        <Loader2
          aria-hidden="true"
          className="account-state__icon spin"
          size={34}
          strokeWidth={1.7}
        />
        <p className="eyebrow">Belikeme account</p>
        <h1 id="session-check-heading">Checking account access</h1>
        <p>{isLoading ? "Waiting for your session." : "Opening sign in."}</p>
      </section>
    </main>
  );
}
