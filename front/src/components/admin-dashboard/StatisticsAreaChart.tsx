"use client";

import { useState } from "react";
import type { AdminRevenueBucket } from "@/features/admin-stats/types";

type StatisticsView = "overview" | "sales" | "revenue";

interface StatisticsAreaChartProps {
  buckets?: AdminRevenueBucket[];
  isLoading?: boolean;
}

const WIDTH = 920;
const HEIGHT = 294;
const LEFT = 54;
const RIGHT = 20;
const TOP = 26;
const BOTTOM = 44;

export function StatisticsAreaChart({
  buckets = [],
  isLoading = false,
}: StatisticsAreaChartProps) {
  const [view, setView] = useState<StatisticsView>("overview");
  const values = getValues(buckets, view);
  const hasData = values.some((value) => value > 0);
  const maxValue = Math.max(...values, 0);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const points = values.map((value, index) => ({
    x:
      values.length <= 1
        ? LEFT + plotWidth / 2
        : LEFT + (index / (values.length - 1)) * plotWidth,
    y: TOP + plotHeight - (value / maxValue) * plotHeight,
  }));
  const linePath = toLinePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x} ${TOP + plotHeight} L ${points[0].x} ${TOP + plotHeight} Z`
    : "";
  const labelStep = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <article className="admin-dashboard-card admin-dashboard-card--statistics">
      <header className="admin-dashboard-statistics-header">
        <div>
          <p className="admin-dashboard-card__kicker">Analytics</p>
          <h2>Statistics</h2>
          <span>{getViewDescription(view)}</span>
        </div>
        <div aria-label="Statistics metric" className="admin-dashboard-tabs" role="tablist">
          {(["overview", "sales", "revenue"] as const).map((tab) => (
            <button
              aria-selected={view === tab}
              className={view === tab ? "is-active" : undefined}
              key={tab}
              onClick={() => setView(tab)}
              role="tab"
              type="button"
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {isLoading && buckets.length === 0 ? (
        <div
          aria-label="Loading statistics"
          className="admin-dashboard-chart-loading"
          role="status"
        >
          <span className="admin-dashboard-skeleton admin-dashboard-skeleton--chart" />
        </div>
      ) : !hasData ? (
        <div className="admin-dashboard-chart-empty" role="status">
          <strong>No statistics for this range</strong>
          <span>Choose another range or retry after verified sales are available.</span>
        </div>
      ) : (
        <div className="admin-dashboard-chart-wrap">
          <svg
            aria-labelledby="statistics-title statistics-description"
            className="admin-dashboard-area-chart"
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <title id="statistics-title">{getViewDescription(view)}</title>
            <desc id="statistics-description">
              Area chart based on backend-confirmed paid revenue buckets.
            </desc>
            <defs>
              <linearGradient id="adminStatisticsFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#111111" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#111111" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = TOP + plotHeight * ratio;
              const value = maxValue * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    className="admin-dashboard-chart-gridline"
                    x1={LEFT}
                    x2={WIDTH - RIGHT}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className="admin-dashboard-chart-axis"
                    textAnchor="end"
                    x={LEFT - 10}
                    y={y + 4}
                  >
                    {formatAxisValue(value, view)}
                  </text>
                </g>
              );
            })}
            <path className="admin-dashboard-area-chart__fill" d={areaPath} />
            <path className="admin-dashboard-area-chart__line" d={linePath} />
            {points.map((point, index) => (
              <circle
                className="admin-dashboard-area-chart__point"
                cx={point.x}
                cy={point.y}
                key={`${buckets[index]?.periodStart}-${index}`}
                r="4"
              >
                <title>
                  {formatDateLabel(buckets[index]?.periodStart)}: {formatAxisValue(values[index], view)}
                </title>
              </circle>
            ))}
            {buckets.map((bucket, index) =>
              index % labelStep === 0 || index === buckets.length - 1 ? (
                <text
                  className="admin-dashboard-chart-axis admin-dashboard-chart-axis--x"
                  key={bucket.periodStart}
                  textAnchor="middle"
                  x={points[index]?.x ?? LEFT}
                  y={HEIGHT - 14}
                >
                  {formatDateLabel(bucket.periodStart)}
                </text>
              ) : null,
            )}
          </svg>
        </div>
      )}
    </article>
  );
}

function getValues(
  buckets: AdminRevenueBucket[],
  view: StatisticsView,
): number[] {
  if (view === "sales") {
    return buckets.map((bucket) => bucket.paidOrdersCount);
  }

  if (view === "overview") {
    let cumulativeRevenue = 0;
    return buckets.map((bucket) => {
      cumulativeRevenue += bucket.revenue;
      return cumulativeRevenue;
    });
  }

  return buckets.map((bucket) => bucket.revenue);
}

function getViewDescription(view: StatisticsView): string {
  if (view === "sales") {
    return "Verified paid order volume";
  }

  if (view === "revenue") {
    return "Verified paid revenue by period";
  }

  return "Cumulative verified paid revenue";
}

function toLinePath(points: { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function formatAxisValue(value: number, view: StatisticsView): string {
  if (view === "sales") {
    return Math.round(value).toLocaleString("en");
  }

  if (value === 0) {
    return "0";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatDateLabel(value?: string): string {
  if (!value) {
    return "Period";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
    year: "2-digit",
  }).format(new Date(value));
}
