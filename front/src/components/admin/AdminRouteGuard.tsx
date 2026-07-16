"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import { useAdminCommonI18n } from "@/features/i18n/admin-common-translations";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, isAuthenticated, isLoading } = useAuthSession();
  const { messages } = useAdminCommonI18n();
  const nextPath = getSafeNextPath(pathname);

  if (isLoading) {
    return (
      <AdminState
        message={messages.guard.checkingMessage}
        title={messages.guard.checkingAccess}
        tone="loading"
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminState
        actions={[
          {
            href: `/login?next=${encodeURIComponent(nextPath)}`,
            label: messages.guard.signIn,
          },
          {
            href: "/products",
            label: messages.guard.backToShop,
            variant: "secondary",
          },
        ]}
        message={messages.guard.signInMessage}
        title={messages.guard.signInRequired}
        tone="signin"
      />
    );
  }

  if (!isAdminUser(currentUser)) {
    return (
      <AdminState
        actions={[
          {
            href: "/products",
            label: messages.guard.backToShop,
          },
          {
            href: "/",
            label: messages.guard.home,
            variant: "secondary",
          },
        ]}
        message={messages.guard.forbiddenMessage}
        meta={
          <span>
            {messages.guard.signedInRole}: {currentUser?.role
              ? messages.roles[currentUser.role]
              : messages.common.unknown}
          </span>
        }
        title={messages.guard.accessRequired}
        tone="forbidden"
      />
    );
  }

  return <>{children}</>;
}

function getSafeNextPath(pathname: string | null): string {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/admin";
  }

  if (pathname.includes("\\")) {
    return "/admin";
  }

  return pathname;
}
