import { ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/features/catalog/format";

interface MonthlyTargetGaugeProps {
  isLoading?: boolean;
  revenue?: number;
  target: number;
}

export function MonthlyTargetGauge({
  isLoading = false,
  revenue,
  target,
}: MonthlyTargetGaugeProps) {
  const safeRevenue = Math.max(revenue ?? 0, 0);
  const percentage = target > 0 ? (safeRevenue / target) * 100 : 0;
  const gaugePercentage = Math.min(percentage, 100);

  return (
    <article className="admin-dashboard-card admin-dashboard-card--target">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">Current month</p>
          <h2>Monthly target</h2>
          <span>Local UI benchmark · not persisted</span>
        </div>
      </header>

      {isLoading && revenue === undefined ? (
        <div
          aria-label="Loading monthly target"
          className="admin-dashboard-gauge-loading"
          role="status"
        >
          <span className="admin-dashboard-skeleton admin-dashboard-skeleton--gauge" />
        </div>
      ) : (
        <div className="admin-dashboard-gauge">
          <svg
            aria-label={`${Math.round(percentage)} percent of the local monthly revenue target`}
            role="img"
            viewBox="0 0 240 142"
          >
            <path
              className="admin-dashboard-gauge__track"
              d="M 30 120 A 90 90 0 0 1 210 120"
              pathLength="100"
            />
            <path
              className="admin-dashboard-gauge__progress"
              d="M 30 120 A 90 90 0 0 1 210 120"
              pathLength="100"
              strokeDasharray={`${gaugePercentage} 100`}
            />
          </svg>
          <div className="admin-dashboard-gauge__value">
            <strong>{Math.round(percentage)}%</strong>
            <span>of local target</span>
          </div>
        </div>
      )}

      <div className="admin-dashboard-target-summary">
        <span>
          <small>Verified revenue</small>
          <strong>{revenue === undefined ? "—" : formatPrice(safeRevenue)}</strong>
        </span>
        <ArrowUpRight aria-hidden="true" size={18} />
        <span>
          <small>UI target</small>
          <strong>{formatPrice(target)}</strong>
        </span>
      </div>
      <p className="admin-dashboard-target-note">
        Paid revenue is finalized only after verified payment webhook.
      </p>
    </article>
  );
}
