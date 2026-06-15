import { ArrowRight, ChartNoAxesColumnIncreasing, Package, Tags, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

const dashboardEntries = [
  {
    description: "Review accounts, roles, and active status.",
    href: "/admin/users",
    icon: Users,
    label: "Users",
  },
  {
    description: "Open product records and variant controls.",
    href: "/admin/products",
    icon: Package,
    label: "Products",
  },
  {
    description: "Organize category names, slugs, and visibility.",
    href: "/admin/categories",
    icon: Tags,
    label: "Categories",
  },
  {
    description: "View paid-order metrics and operational summaries.",
    href: "/admin/stats",
    icon: ChartNoAxesColumnIncreasing,
    label: "Stats",
  },
] as const;

export default function AdminPage() {
  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard__hero" aria-labelledby="admin-heading">
        <p className="eyebrow">Admin dashboard</p>
        <h1 id="admin-heading">Belikeme operations</h1>
        <p>
          Use the admin sections to manage catalog and account workflows as they
          are connected.
        </p>
      </section>

      <section aria-label="Admin sections" className="admin-dashboard__grid">
        {dashboardEntries.map((entry) => {
          const Icon = entry.icon;

          return (
            <Link className="admin-entry-card" href={entry.href} key={entry.href}>
              <span className="admin-entry-card__icon">
                <Icon aria-hidden="true" size={23} strokeWidth={1.7} />
              </span>
              <span className="admin-entry-card__copy">
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="admin-entry-card__arrow"
                size={19}
                strokeWidth={1.8}
              />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
