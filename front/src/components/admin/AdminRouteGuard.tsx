"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminState } from "@/components/admin/AdminState";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";

const ROLE_LABELS = {
  ADMIN: "Administrator",
  CUSTOMER: "Customer",
  STAFF: "Staff",
} as const;

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, isAuthenticated, isLoading } = useAuthSession();
  const nextPath = getSafeNextPath(pathname);

  if (isLoading) {
    return (
      <AdminState
        message={"Waiting for your session before opening the admin workspace."}
        title={"Checking admin access"}
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
            label: "Sign in",
          },
          {
            href: "/products",
            label: "Back to shop",
            variant: "secondary",
          },
        ]}
        message={"Sign in with an admin account to continue."}
        title={"Admin sign-in required"}
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
            label: "Back to shop",
          },
          {
            href: "/",
            label: "Home",
            variant: "secondary",
          },
        ]}
        message={"This account does not have permission to open the admin workspace."}
        meta={
          <span>
            {"Signed in role"}: {currentUser?.role
              ? ROLE_LABELS[currentUser.role]
              : "Unknown"}
          </span>
        }
        title={"Admin access required"}
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
