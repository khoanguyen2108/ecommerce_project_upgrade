"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useAdminCommonI18n } from "@/features/i18n/admin-common-translations";

export interface DashboardDateRange {
  from: string;
  to: string;
}

interface AdminDashboardFiltersProps {
  isLoading: boolean;
  onApply: (range: DashboardDateRange) => void;
  onRefresh: () => void;
  value: DashboardDateRange;
}

type DatePreset = "current-year" | "last-30" | "last-90" | "last-365";

export function AdminDashboardFilters({
  isLoading,
  onApply,
  onRefresh,
  value,
}: AdminDashboardFiltersProps) {
  const [draft, setDraft] = useState(value);
  const [validationError, setValidationError] = useState<"missing" | "order">();
  const { messages } = useAdminCommonI18n();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.from || !draft.to) {
      setValidationError("missing");
      return;
    }

    if (draft.from > draft.to) {
      setValidationError("order");
      return;
    }

    setValidationError(undefined);
    onApply(draft);
  }

  function handlePreset(preset: DatePreset) {
    const nextRange = getPresetDateRange(preset);
    setDraft(nextRange);
    setValidationError(undefined);
    onApply(nextRange);
  }

  return (
    <section
      className="admin-dashboard-filters"
      aria-label={messages.dashboard.dateFilters}
    >
      <form onSubmit={handleSubmit}>
        <label className="admin-dashboard-filters__preset">
          <span>{messages.dashboard.range}</span>
          <select
            defaultValue="current-year"
            disabled={isLoading}
            onChange={(event) => handlePreset(event.target.value as DatePreset)}
          >
            <option value="current-year">{messages.dashboard.currentYear}</option>
            <option value="last-30">{messages.dashboard.last30Days}</option>
            <option value="last-90">{messages.dashboard.last90Days}</option>
            <option value="last-365">{messages.dashboard.last12Months}</option>
          </select>
        </label>
        <label>
          <span>{messages.dashboard.from}</span>
          <input
            max={draft.to || getTodayInputValue()}
            onChange={(event) =>
              setDraft((current) => ({ ...current, from: event.target.value }))
            }
            type="date"
            value={draft.from}
          />
        </label>
        <label>
          <span>{messages.dashboard.to}</span>
          <input
            max={getTodayInputValue()}
            min={draft.from}
            onChange={(event) =>
              setDraft((current) => ({ ...current, to: event.target.value }))
            }
            type="date"
            value={draft.to}
          />
        </label>
        <button className="admin-dashboard-filter-button" disabled={isLoading} type="submit">
          <CalendarDays aria-hidden="true" size={17} />
          {messages.dashboard.apply}
        </button>
        <button
          aria-label={messages.dashboard.refreshLabel}
          className="admin-dashboard-refresh-button"
          disabled={isLoading}
          onClick={onRefresh}
          title={messages.dashboard.refreshLabel}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={isLoading ? "spin" : undefined}
            size={18}
          />
        </button>
      </form>
      {validationError ? (
        <p role="alert">
          {validationError === "missing"
            ? messages.dashboard.chooseBothDates
            : messages.dashboard.dateOrderError}
        </p>
      ) : null}
    </section>
  );
}

export function getDefaultDashboardDateRange(): DashboardDateRange {
  return getPresetDateRange("current-year");
}

function getPresetDateRange(preset: DatePreset): DashboardDateRange {
  const today = new Date();
  const from = new Date(today);

  if (preset === "current-year") {
    from.setMonth(0, 1);
  } else {
    const days = preset === "last-30" ? 29 : preset === "last-90" ? 89 : 364;
    from.setDate(from.getDate() - days);
  }

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(today),
  };
}

function getTodayInputValue(): string {
  return toDateInputValue(new Date());
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
