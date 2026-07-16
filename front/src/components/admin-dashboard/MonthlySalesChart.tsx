"use client";

import type { AdminRevenueBucket } from "@/features/admin-stats/types";
import {
  getIntlLocale,
  useAdminCommonI18n,
} from "@/features/i18n/admin-common-translations";
import type { Locale } from "@/features/i18n/locale";

interface MonthlySalesChartProps {
  buckets?: AdminRevenueBucket[];
  isLoading?: boolean;
}

const CHART_WIDTH = 760;
const CHART_HEIGHT = 278;
const PLOT_LEFT = 54;
const PLOT_RIGHT = 18;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 44;

export function MonthlySalesChart({
  buckets = [],
  isLoading = false,
}: MonthlySalesChartProps) {
  const { locale, messages } = useAdminCommonI18n();
  const hasSales = buckets.some((bucket) => bucket.revenue > 0);
  const maxValue = Math.max(...buckets.map((bucket) => bucket.revenue), 0);
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const slotWidth = buckets.length > 0 ? plotWidth / buckets.length : plotWidth;
  const barWidth = Math.max(8, Math.min(34, slotWidth * 0.54));
  const labelStep = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <article className="admin-dashboard-card admin-dashboard-card--sales">
      <header className="admin-dashboard-card__header">
        <div>
          <p className="admin-dashboard-card__kicker">
            {messages.dashboard.performance}
          </p>
          <h2>{messages.dashboard.monthlySales}</h2>
          <span>{messages.dashboard.monthlySalesDescription}</span>
        </div>
        <span className="admin-dashboard-legend">
          <i aria-hidden="true" /> {messages.dashboard.paidRevenue}
        </span>
      </header>

      {isLoading && buckets.length === 0 ? (
        <ChartLoading label={messages.dashboard.loadingMonthlySales} />
      ) : !hasSales ? (
        <div className="admin-dashboard-chart-empty" role="status">
          <strong>{messages.dashboard.noSales}</strong>
          <span>{messages.dashboard.noSalesDescription}</span>
        </div>
      ) : (
        <div className="admin-dashboard-chart-wrap">
          <svg
            aria-labelledby="monthly-sales-title monthly-sales-description"
            className="admin-dashboard-bar-chart"
            role="img"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <title id="monthly-sales-title">{messages.dashboard.chartTitle}</title>
            <desc id="monthly-sales-description">
              {messages.dashboard.chartDescription}
            </desc>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = PLOT_TOP + plotHeight * ratio;
              const value = maxValue * (1 - ratio);

              return (
                <g key={ratio}>
                  <line
                    className="admin-dashboard-chart-gridline"
                    x1={PLOT_LEFT}
                    x2={CHART_WIDTH - PLOT_RIGHT}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className="admin-dashboard-chart-axis"
                    textAnchor="end"
                    x={PLOT_LEFT - 10}
                    y={y + 4}
                  >
                    {formatCompactCurrency(value, locale)}
                  </text>
                </g>
              );
            })}
            {buckets.map((bucket, index) => {
              const height = (bucket.revenue / maxValue) * plotHeight;
              const x = PLOT_LEFT + slotWidth * index + (slotWidth - barWidth) / 2;

              return (
                <g key={`${bucket.periodStart}-${index}`}>
                  <rect
                    className="admin-dashboard-chart-bar"
                    height={Math.max(height, 2)}
                    rx="5"
                    width={barWidth}
                    x={x}
                    y={PLOT_TOP + plotHeight - Math.max(height, 2)}
                  >
                    <title>
                      {formatBucketLabel(bucket.periodStart, true, locale)}: {formatCurrency(bucket.revenue, locale)}
                    </title>
                  </rect>
                  {index % labelStep === 0 || index === buckets.length - 1 ? (
                    <text
                      className="admin-dashboard-chart-axis admin-dashboard-chart-axis--x"
                      textAnchor="middle"
                      x={x + barWidth / 2}
                      y={CHART_HEIGHT - 15}
                    >
                      {formatBucketLabel(
                        bucket.periodStart,
                        buckets.length > 12,
                        locale,
                      )}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </article>
  );
}

function ChartLoading({ label }: { label: string }) {
  return (
    <div aria-label={label} className="admin-dashboard-chart-loading" role="status">
      <span className="admin-dashboard-skeleton admin-dashboard-skeleton--chart" />
    </div>
  );
}

function formatBucketLabel(
  value: string,
  includeYear: boolean,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: "short",
    timeZone: "UTC",
    ...(includeYear ? { year: "2-digit" } : {}),
  }).format(new Date(value));
}

function formatCompactCurrency(value: number, locale: Locale): string {
  if (value === 0) {
    return "0";
  }

  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatCurrency(value: number, locale: Locale): string {
  const amount = new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 0,
  }).format(value);

  return `${amount}\u00a0VND`;
}
