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
    label: "Dashboard",
  },
  {
    href: "/admin/chats",
    icon: MessageCircle,
    label: "Chats",
    notificationKey: "chats",
  },
  {
    href: "/admin/orders",
    icon: ClipboardList,
    label: "Orders",
    notificationKey: "orders",
  },
  {
    href: "/admin/returns",
    icon: RotateCcw,
    label: "Returns",
    notificationKey: "returns",
  },
  {
    href: "/admin/users",
    icon: Users,
    label: "Users",
  },
  {
    href: "/admin/products",
    icon: Package,
    label: "Products",
  },
  {
    href: "/admin/categories",
    icon: Tags,
    label: "Categories",
  },
  {
    href: "/admin/landing-gallery",
    icon: ImageIcon,
    label: "Landing Gallery",
  },
  {
    href: "/admin/vouchers",
    icon: TicketPercent,
    label: "Vouchers",
  },
] as const;

export function AdminNav() {
  const pathname = usePathname() || "/admin";
  const { currentUser, isLoading } = useAuthSession();
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
    <nav aria-label="Admin navigation" className="admin-nav">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const isCurrent = isActiveAdminPath(pathname, item.href);
        const notificationKey =
          "notificationKey" in item ? item.notificationKey : undefined;
        const notificationCount = notificationKey
          ? notificationCounts[notificationKey]
          : 0;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            aria-label={getNavItemAriaLabel(item.label, notificationCount)}
            className={`admin-nav__link ${isCurrent ? "is-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="admin-nav__label">{item.label}</span>
            <AdminNavNotificationBadge
              count={notificationCount}
              itemLabel={item.label}
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
}: {
  count: number;
  itemLabel: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="admin-nav__notification"
      title={`${count} new ${itemLabel.toLowerCase()}`}
    >
      {formatNotificationCount(count)}
    </span>
  );
}

function getNavItemAriaLabel(label: string, count: number): string {
  if (count <= 0) {
    return label;
  }

  return `${label}, ${count} new`;
}

function formatNotificationCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
