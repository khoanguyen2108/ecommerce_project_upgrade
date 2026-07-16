"use client";

import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAdminCommonI18n } from "@/features/i18n/admin-common-translations";

type AdminStateTone = "forbidden" | "loading" | "signin";

interface AdminStateAction {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}

interface AdminStateProps {
  actions?: AdminStateAction[];
  message: string;
  meta?: ReactNode;
  title: string;
  tone: AdminStateTone;
}

export function AdminState({
  actions = [],
  message,
  meta,
  title,
  tone,
}: AdminStateProps) {
  const { messages } = useAdminCommonI18n();
  const Icon =
    tone === "loading" ? Loader2 : tone === "forbidden" ? ShieldAlert : ShieldCheck;

  return (
    <main className="admin-guard-page">
      <section
        aria-labelledby="admin-state-heading"
        className={`admin-state admin-state--${tone}`}
        role={tone === "forbidden" ? "alert" : "status"}
      >
        <Icon
          aria-hidden="true"
          className={`admin-state__icon ${tone === "loading" ? "spin" : ""}`}
          size={34}
          strokeWidth={1.7}
        />
        <p className="eyebrow">{messages.guard.eyebrow}</p>
        <h1 id="admin-state-heading">{title}</h1>
        <p>{message}</p>

        {meta ? <div className="admin-state__meta">{meta}</div> : null}

        {actions.length > 0 ? (
          <div className="admin-state__actions">
            {actions.map((action) => (
              <Link
                className={`button ${
                  action.variant === "secondary"
                    ? "button--secondary"
                    : "button--primary"
                }`}
                href={action.href}
                key={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
