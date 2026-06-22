import type { Metadata } from "next";
import { AdminUsersPage } from "@/components/admin-users/AdminUsersPage";
import type { AdminUserQuery } from "@/features/admin-users/types";
import type { AuthProvider, UserRole } from "@/features/auth/types";

export const metadata: Metadata = {
  title: "Users",
};

interface AdminUsersRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersRoute({
  searchParams,
}: AdminUsersRouteProps) {
  const params = searchParams ? await searchParams : {};

  return <AdminUsersPage initialQuery={parseInitialQuery(params)} />;
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): AdminUserQuery {
  return {
    authProvider: parseAuthProvider(getFirst(params.authProvider)),
    isActive: parseBoolean(getFirst(params.isActive)),
    limit: 20,
    page: parsePositiveInteger(getFirst(params.page)) || 1,
    role: parseRole(getFirst(params.role)),
    search: getFirst(params.search),
  };
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseRole(value: string | undefined): UserRole | undefined {
  if (value === "CUSTOMER" || value === "STAFF" || value === "ADMIN") {
    return value;
  }

  return undefined;
}

function parseAuthProvider(value: string | undefined): AuthProvider | undefined {
  if (value === "EMAIL" || value === "GOOGLE") {
    return value;
  }

  return undefined;
}
