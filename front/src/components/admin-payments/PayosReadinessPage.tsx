"use client";

import { CheckCircle2, Copy, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminFeedback, AdminPaymentSafetyNote } from "@/components/admin/AdminCommerceUi";
import { getPayosReadiness } from "@/features/admin-payments/api";
import {
  getAdminPaymentErrorMessage,
  getAdminPaymentRequestId,
} from "@/features/admin-payments/errors";
import type {
  PayosReadiness,
  PayosSecretState,
  PayosUrlState,
} from "@/features/admin-payments/types";

const CONFIG_FLAGS: Array<{ key: keyof PayosReadiness; label: string }> = [
  { key: "payosClientIdConfigured", label: "PAYOS_CLIENT_ID configured" },
  { key: "payosApiKeyConfigured", label: "PAYOS_API_KEY configured" },
  { key: "payosChecksumKeyConfigured", label: "PAYOS_CHECKSUM_KEY configured" },
  { key: "returnUrlConfigured", label: "PAYMENT_RETURN_URL configured" },
  { key: "cancelUrlConfigured", label: "PAYMENT_CANCEL_URL configured" },
  { key: "webhookUrlConfigured", label: "PAYMENT_WEBHOOK_URL configured" },
  { key: "webhookPathMatches", label: "Webhook endpoint path matches" },
  { key: "backendUrlConfigured", label: "BACKEND_URL configured" },
];

export function PayosReadinessPage() {
  const [readiness, setReadiness] = useState<PayosReadiness>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);
      try {
        const response = await getPayosReadiness();
        if (active) setReadiness(response.readiness);
      } catch (loadError) {
        if (active) {
          setReadiness(undefined);
          setError(getAdminPaymentErrorMessage(loadError, "payOS readiness could not be loaded."));
          setRequestId(getAdminPaymentRequestId(loadError));
        }
      } finally { if (active) setIsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <div className="admin-resource">
      <section className="admin-resource__header" aria-labelledby="payos-readiness-heading"><h1 id="payos-readiness-heading">payOS Readiness</h1><button className="button button--secondary" disabled={isLoading} onClick={() => setRefreshKey((current) => current + 1)} type="button"><RefreshCw aria-hidden="true" className={isLoading ? "spin" : undefined} size={17} />Refresh</button></section>
      <AdminPaymentSafetyNote />
      <div className="admin-readiness-disclaimer" role="note"><strong>Local configuration check only.</strong><span>This checks configuration presence and URL shape. It does not verify real provider checkout or webhook delivery, and it never calls payOS.</span></div>
      {error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}

      {isLoading && !readiness ? <div className="admin-detail-loading" role="status"><span className="admin-skeleton-line admin-skeleton-line--wide" /><span className="admin-skeleton-line" /><span className="admin-skeleton-line admin-skeleton-line--wide" /></div> : null}
      {readiness ? <>
        <section className={`admin-readiness-hero ${readiness.environmentReady ? "admin-readiness-hero--ready" : "admin-readiness-hero--warning"}`}><div>{readiness.environmentReady ? <CheckCircle2 aria-hidden="true" size={30} /> : <ShieldAlert aria-hidden="true" size={30} />}<span><small>Environment ready</small><strong>{readiness.environmentReady ? "Yes" : "No"}</strong></span></div><p>{readiness.environmentReady ? "All required local payOS configuration checks passed." : "One or more required local configuration checks need attention."}</p></section>
        <section className="admin-readiness-grid" aria-label="payOS configuration presence">{CONFIG_FLAGS.map((flag) => { const configured = Boolean(readiness[flag.key]); return <article className="admin-readiness-card" key={flag.key}><span>{flag.label}</span><strong className={`admin-badge ${configured ? "admin-badge--success" : "admin-badge--muted"}`}>{configured ? "Yes" : "No"}</strong></article>; })}</section>
        <section className="admin-detail-card">
          <p className="eyebrow">Masked credential diagnostics</p>
          <div className="admin-readiness-grid">
            <SecretStateCard label="PAYOS_CLIENT_ID" state={readiness.credentials.clientId} />
            <SecretStateCard label="PAYOS_API_KEY" state={readiness.credentials.apiKey} />
            <SecretStateCard label="PAYOS_CHECKSUM_KEY" state={readiness.credentials.checksumKey} />
          </div>
          <small>Only presence and length are returned. Raw credential values never leave the backend.</small>
        </section>
        <section className="admin-detail-card">
          <p className="eyebrow">Payment routes</p>
          <div className="admin-readiness-url-list">
            <UrlStateRow label="Return URL" state={readiness.urls.return} />
            <UrlStateRow label="Cancel URL" state={readiness.urls.cancel} />
            <UrlStateRow copyable label="Webhook URL" state={readiness.urls.webhook} />
          </div>
          <small>Required backend webhook path: <code>{readiness.webhookEndpointPath}</code></small>
        </section>
        <section className="admin-detail-card"><p className="eyebrow">Warnings</p>{readiness.warnings.length === 0 ? <div className="admin-panel__empty">No local configuration warnings were returned.</div> : <ul className="admin-warning-list">{readiness.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</section>
      </> : null}
    </div>
  );
}

function SecretStateCard({ label, state }: { label: string; state: PayosSecretState }) {
  return (
    <article className="admin-readiness-card">
      <span>{label}</span>
      <strong>{state.present ? `Present (${state.length} chars)` : "Missing"}</strong>
    </article>
  );
}

function UrlStateRow({
  copyable = false,
  label,
  state,
}: {
  copyable?: boolean;
  label: string;
  state: PayosUrlState;
}) {
  return (
    <div className="admin-readiness-url-row">
      <span>
        <strong>{label}</strong>
        <small>{state.host || "Host unavailable"}</small>
      </span>
      <code>{state.url || (state.configured ? "Invalid URL" : "Not configured")}</code>
      {copyable && state.url ? (
        <button
          aria-label={`Copy ${label}`}
          className="icon-button admin-icon-button"
          onClick={() => void navigator.clipboard.writeText(state.url || "")}
          title={`Copy ${label}`}
          type="button"
        >
          <Copy aria-hidden="true" size={16} />
        </button>
      ) : null}
    </div>
  );
}
