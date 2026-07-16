"use client";

import {
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  MessageCircle,
  Package,
  RotateCcw,
  Tags,
  TicketPercent,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listAdminOrders } from "@/features/admin-orders/api";
import { ADMIN_NAV_NOTIFICATIONS_REFRESH_EVENT } from "@/features/admin-notifications/events";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import { listAdminChatConversations } from "@/features/chat/api";
import { listAdminReturns } from "@/features/returns/api";
import {
  formatAdminNotificationLabel,
  formatAdminNotificationTitle,
  getIntlLocale,
  useAdminCommonI18n,
} from "@/features/i18n/admin-common-translations";
import type { Locale } from "@/features/i18n/locale";

type AdminNotificationKey = "chats" | "orders" | "returns";

interface AdminNavNotificationCounts {
  chats: number;
  orders: number;
  returns: number;
}

const EMPTY_NOTIFICATION_COUNTS: AdminNavNotificationCounts = {
  chats: 0,
  orders: 0,
  returns: 0,
};

const ADMIN_NAV_NOTIFICATION_REFRESH_MS = 30_000;

const adminNavItems = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    labelKey: "dashboard",
  },
  {
    href: "/admin/chats",
    icon: MessageCircle,
    labelKey: "chats",
    notificationKey: "chats",
  },
  {
    href: "/admin/orders",
    icon: ClipboardList,
    labelKey: "orders",
    notificationKey: "orders",
  },
  {
    href: "/admin/returns",
    icon: RotateCcw,
    labelKey: "returns",
    notificationKey: "returns",
  },
  {
    href: "/admin/users",
    icon: Users,
    labelKey: "users",
  },
  {
    href: "/admin/products",
    icon: Package,
    labelKey: "products",
  },
  {
    href: "/admin/categories",
    icon: Tags,
    labelKey: "categories",
  },
  {
    href: "/admin/landing-gallery",
    icon: ImageIcon,
    labelKey: "gallery",
  },
  {
    href: "/admin/vouchers",
    icon: TicketPercent,
    labelKey: "vouchers",
  },
] as const;

export function AdminNav() {
  const pathname = usePathname() || "/admin";
  const { currentUser, isLoading } = useAuthSession();
  const { locale, messages } = useAdminCommonI18n();
  const [notificationCounts, setNotificationCounts] =
    useState<AdminNavNotificationCounts>(EMPTY_NOTIFICATION_COUNTS);
  const shouldLoadNotifications = !isLoading && isAdminUser(currentUser);

  const getNotificationCounts = useCallback(async () => {
    const [chatsResult, ordersResult, returnsResult] = await Promise.allSettled([
      listAdminChatConversations(),
      listAdminOrders({
        fulfillmentStatus: "PENDING",
        limit: 1,
        page: 1,
        status: "PAID",
      }),
      listAdminReturns({
        limit: 1,
        page: 1,
        status: "PENDING",
      }),
    ]);

    return {
      chats:
        chatsResult.status === "fulfilled"
          ? chatsResult.value.conversations.reduce(
              (total, conversation) => total + conversation.unreadCount,
              0,
            )
          : undefined,
      orders:
        ordersResult.status === "fulfilled"
          ? ordersResult.value.pagination.total
          : undefined,
      returns:
        returnsResult.status === "fulfilled"
          ? returnsResult.value.pagination.total
          : undefined,
    } satisfies Partial<AdminNavNotificationCounts>;
  }, []);

  useEffect(() => {
    if (!shouldLoadNotifications) {
      setNotificationCounts(EMPTY_NOTIFICATION_COUNTS);
      return;
    }

    let isMounted = true;
    const refreshIfMounted = () => {
      void getNotificationCounts().then((counts) => {
        if (!isMounted) {
          return;
        }

        setNotificationCounts((current) => ({
          chats: counts.chats ?? current.chats,
          orders: counts.orders ?? current.orders,
          returns: counts.returns ?? current.returns,
        }));
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshIfMounted();
      }
    };
    const intervalId = window.setInterval(
      refreshIfMounted,
      ADMIN_NAV_NOTIFICATION_REFRESH_MS,
    );

    refreshIfMounted();
    window.addEventListener("focus", refreshIfMounted);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener(
      ADMIN_NAV_NOTIFICATIONS_REFRESH_EVENT,
      refreshIfMounted,
    );

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfMounted);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(
        ADMIN_NAV_NOTIFICATIONS_REFRESH_EVENT,
        refreshIfMounted,
      );
    };
  }, [pathname, getNotificationCounts, shouldLoadNotifications]);

  return (
    <nav aria-label={messages.navigation.label} className="admin-nav">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const label = messages.navigation[item.labelKey];
        const isCurrent = isActiveAdminPath(pathname, item.href);
        const notificationKey =
          "notificationKey" in item ? item.notificationKey : undefined;
        const notificationCount = notificationKey
          ? notificationCounts[notificationKey]
          : 0;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            aria-label={getNavItemAriaLabel(locale, label, notificationCount)}
            className={`admin-nav__link ${isCurrent ? "is-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="admin-nav__label">{label}</span>
            <AdminNavNotificationBadge
              count={notificationCount}
              itemLabel={label}
              locale={locale}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function isActiveAdminPath(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavNotificationBadge({
  count,
  itemLabel,
  locale,
}: {
  count: number;
  itemLabel: string;
  locale: Locale;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="admin-nav__notification"
      title={formatAdminNotificationTitle(locale, itemLabel, count)}
    >
      {formatNotificationCount(count, locale)}
    </span>
  );
}

function getNavItemAriaLabel(
  locale: Locale,
  label: string,
  count: number,
): string {
  if (count <= 0) {
    return label;
  }

  return formatAdminNotificationLabel(locale, label, count);
}

function formatNotificationCount(count: number, locale: Locale): string {
  return count > 99
    ? "99+"
    : new Intl.NumberFormat(getIntlLocale(locale)).format(count);
}
