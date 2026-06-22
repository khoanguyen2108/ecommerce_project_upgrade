import type { LucideIcon } from "lucide-react";

interface AdminMetricCardProps {
  detail: string;
  icon: LucideIcon;
  isLoading?: boolean;
  label: string;
  value?: string;
}

export function AdminMetricCard({
  detail,
  icon: Icon,
  isLoading = false,
  label,
  value,
}: AdminMetricCardProps) {
  return (
    <article className="admin-dashboard-metric">
      <div className="admin-dashboard-metric__icon">
        <Icon aria-hidden="true" size={21} strokeWidth={1.9} />
      </div>
      <div className="admin-dashboard-metric__body">
        <span>{label}</span>
        {isLoading ? (
          <span
            aria-label={`Loading ${label}`}
            className="admin-dashboard-skeleton admin-dashboard-skeleton--value"
            role="status"
          />
        ) : (
          <strong>{value ?? "—"}</strong>
        )}
        <small>{detail}</small>
      </div>
    </article>
  );
}
