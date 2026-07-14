export const ADMIN_NAV_NOTIFICATIONS_REFRESH_EVENT =
  "admin-nav-notifications:refresh";

export function requestAdminNavNotificationsRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_NAV_NOTIFICATIONS_REFRESH_EVENT));
}
