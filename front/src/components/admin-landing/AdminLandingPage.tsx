"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAdminLandingPage,
  updateAdminLandingPage,
} from "@/features/admin-landing/api";
import { getAdminLandingError } from "@/features/admin-landing/errors";
import type { AdminLandingPage as AdminLandingData } from "@/features/admin-landing/types";

interface LandingFormState {
  heroEyebrow: string;
  heroImageUrl: string;
  heroSubtitle: string;
  heroTitle: string;
}

const EMPTY_FORM: LandingFormState = {
  heroEyebrow: "",
  heroImageUrl: "",
  heroSubtitle: "",
  heroTitle: "",
};

export function AdminLandingPage() {
  const [landing, setLanding] = useState<AdminLandingData>();
  const [form, setForm] = useState<LandingFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadLandingPage() {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await getAdminLandingPage();

        if (!isMounted) return;

        setLanding(response);
        setForm(toFormState(response));
      } catch (loadError) {
        if (!isMounted) return;

        const details = getAdminLandingError(loadError);
        setError(details.message);
        setRequestId(details.requestId);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadLandingPage();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    if (form.heroImageUrl.trim() && !isPublicHttpUrl(form.heroImageUrl)) {
      setError("Enter a valid public HTTP or HTTPS URL for the hero image.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateAdminLandingPage({
        heroEyebrow: normalizeText(form.heroEyebrow),
        heroImageUrl: normalizeText(form.heroImageUrl),
        heroSubtitle: normalizeText(form.heroSubtitle),
        heroTitle: normalizeText(form.heroTitle),
      });

      setLanding(response);
      setForm(toFormState(response));
      setSuccess("Landing page settings saved.");
    } catch (saveError) {
      const details = getAdminLandingError(saveError);
      setError(details.message);
      setRequestId(details.requestId);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-resource admin-resource--landing">
      <section className="admin-resource__header" aria-labelledby="landing-heading">
        <div>
          <p className="eyebrow">Storefront content</p>
          <h1 id="landing-heading">Landing Page</h1>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Refresh
        </button>
      </section>

      {success ? <AdminFeedback message={success} tone="success" /> : null}
      {error ? (
        <AdminFeedback message={error} requestId={requestId} tone="error" />
      ) : null}

      <div className="admin-landing-grid">
        <section className="admin-landing-card" aria-labelledby="hero-settings-heading">
          <header>
            <div>
              <p className="eyebrow">Hero image settings</p>
              <h2 id="hero-settings-heading">Main campaign visual</h2>
            </div>
            <ImageIcon aria-hidden="true" size={22} />
          </header>

          <div className="admin-landing-preview">
            {form.heroImageUrl.trim() ? (
              <img alt="Landing page hero preview" src={form.heroImageUrl.trim()} />
            ) : (
              <div>
                <ImageIcon aria-hidden="true" size={28} />
                <span>Current storefront fallback image</span>
              </div>
            )}
          </div>

          <form className="admin-form" onSubmit={handleSave}>
            <label>
              <span>Hero Image URL</span>
              <input
                disabled={isLoading}
                maxLength={2048}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    heroImageUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/hero.jpg"
                type="url"
                value={form.heroImageUrl}
              />
              <small>Use a publicly accessible image URL.</small>
            </label>

            <label>
              <span>Hero eyebrow</span>
              <input
                disabled={isLoading}
                maxLength={120}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    heroEyebrow: event.target.value,
                  }))
                }
                value={form.heroEyebrow}
              />
            </label>

            <label>
              <span>Hero title</span>
              <input
                disabled={isLoading}
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    heroTitle: event.target.value,
                  }))
                }
                value={form.heroTitle}
              />
            </label>

            <label>
              <span>Hero subtitle</span>
              <textarea
                disabled={isLoading}
                maxLength={300}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    heroSubtitle: event.target.value,
                  }))
                }
                rows={4}
                value={form.heroSubtitle}
              />
            </label>

            <p className="admin-landing-help">
              This replaces the main image behind the landing page hero.
            </p>

            <div className="admin-landing-actions">
              <button
                className="button button--secondary"
                disabled={isLoading || !form.heroImageUrl}
                onClick={() =>
                  setForm((current) => ({ ...current, heroImageUrl: "" }))
                }
                type="button"
              >
                <Trash2 aria-hidden="true" size={17} />
                Clear image
              </button>
              <button
                className="button button--primary"
                disabled={isLoading || isSaving}
                type="submit"
              >
                <Save aria-hidden="true" size={17} />
                {isSaving ? "Saving" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <aside className="admin-landing-card" aria-labelledby="featured-summary-heading">
          <header>
            <div>
              <p className="eyebrow">Featured categories</p>
              <h2 id="featured-summary-heading">Landing category order</h2>
            </div>
            <span className="admin-landing-count">
              {landing?.featuredCategories.length || 0}/3
            </span>
          </header>

          <p className="admin-landing-help">
            Choose up to 3 categories and set their order from the category editor.
          </p>

          <div className="admin-landing-categories">
            {isLoading ? <div className="admin-landing-empty">Loading categories…</div> : null}
            {!isLoading && !landing?.featuredCategories.length ? (
              <div className="admin-landing-empty">No categories are featured yet.</div>
            ) : null}
            {landing?.featuredCategories.map((category) => (
              <article key={category.id}>
                {category.imageUrl ? (
                  <img alt="" src={category.imageUrl} />
                ) : (
                  <div className="admin-landing-category-fallback" aria-hidden="true" />
                )}
                <span>
                  <small>Featured #{category.featuredOrder}</small>
                  <strong>{category.name}</strong>
                </span>
              </article>
            ))}
          </div>

          <Link className="button button--secondary button--full" href="/admin/categories">
            Edit featured categories
            <ExternalLink aria-hidden="true" size={17} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function toFormState(landing: AdminLandingData): LandingFormState {
  return {
    heroEyebrow: landing.heroEyebrow || "",
    heroImageUrl: landing.heroImageUrl || "",
    heroSubtitle: landing.heroSubtitle || "",
    heroTitle: landing.heroTitle || "",
  };
}

function normalizeText(value: string): string | null {
  return value.trim() || null;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function AdminFeedback({
  message,
  requestId,
  tone,
}: {
  message: string;
  requestId?: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`admin-feedback admin-feedback--${tone}`} role="status">
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
    </div>
  );
}
