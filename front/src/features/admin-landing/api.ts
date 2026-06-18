import { apiRequest } from "@/lib/api/client";
import type {
  AdminLandingPage,
  UpdateAdminLandingPageRequest,
} from "@/features/admin-landing/types";

export function getAdminLandingPage(): Promise<AdminLandingPage> {
  return apiRequest<AdminLandingPage>("/admin/landing-page", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function updateAdminLandingPage(
  payload: UpdateAdminLandingPageRequest,
): Promise<AdminLandingPage> {
  return apiRequest<AdminLandingPage>("/admin/landing-page", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "PATCH",
  });
}
