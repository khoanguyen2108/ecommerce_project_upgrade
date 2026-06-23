import type { User, UserRole } from "@/features/auth/types";

export const USER_ROLES = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
} as const satisfies Record<UserRole, UserRole>;

export function isAdminUser(user: Pick<User, "role"> | undefined): boolean {
  return user?.role === USER_ROLES.ADMIN;
}

export function getPostLoginRedirectPath(
  user: Pick<User, "role"> | undefined,
  customerRedirectPath: string,
): string {
  if (isAdminUser(user)) {
    return "/admin";
  }

  return customerRedirectPath;
}
