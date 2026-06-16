"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

interface AuthenticatedRouteGuardProps {
  areaLabel?: string;
  children: ReactNode;
  loadingMessage?: string;
  loadingTitle?: string;
  returnPath?: string;
  signInMessage?: string;
  signInTitle?: string;
}

export function AuthenticatedRouteGuard({
  areaLabel = "Belikeme account",
  children,
  loadingMessage = "Waiting for your session before opening this page.",
  loadingTitle = "Checking account access",
  returnPath,
  signInMessage = "Sign in to view this account area.",
  signInTitle = "Sign-in required",
}: AuthenticatedRouteGuardProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthSession();
  const nextPath = getSafeNextPath(returnPath || pathname || "/products");

  if (isLoading) {
    return (
      <main className="account-state-page">
        <section
          aria-labelledby="account-state-heading"
          className="account-state account-state--loading"
          role="status"
        >
          <Loader2
            aria-hidden="true"
            className="account-state__icon spin"
            size={34}
            strokeWidth={1.7}
          />
          <p className="eyebrow">{areaLabel}</p>
          <h1 id="account-state-heading">{loadingTitle}</h1>
          <p>{loadingMessage}</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="account-state-page">
        <section
          aria-labelledby="account-state-heading"
          className="account-state account-state--signin"
          role="status"
        >
          <LogIn
            aria-hidden="true"
            className="account-state__icon"
            size={34}
            strokeWidth={1.7}
          />
          <p className="eyebrow">{areaLabel}</p>
          <h1 id="account-state-heading">{signInTitle}</h1>
          <p>{signInMessage}</p>
          <div className="account-state__actions">
            <Link
              className="button button--primary"
              href={`/login?next=${encodeURIComponent(nextPath)}`}
            >
              Sign in
            </Link>
            <Link className="button button--secondary" href="/products">
              Back to products
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

function getSafeNextPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/products";
  }

  return path;
}
