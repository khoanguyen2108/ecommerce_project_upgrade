"use client";

import {
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Package,
  Tags,
  TicketPercent,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavItems = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "Dashboard",
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
    href: "/admin/vouchers",
    icon: TicketPercent,
    label: "Vouchers",
  },
  {
    href: "/admin/chats",
    icon: MessageCircle,
    label: "Chats",
  },
  {
    href: "/admin/orders",
    icon: ClipboardList,
    label: "Orders",
  },
] as const;

export function AdminNav() {
  const pathname = usePathname() || "/admin";

  return (
    <nav aria-label="Admin navigation" className="admin-nav">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        const isCurrent = isActiveAdminPath(pathname, item.href);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={`admin-nav__link ${isCurrent ? "is-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
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
