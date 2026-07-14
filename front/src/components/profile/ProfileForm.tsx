"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { updateMe } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import type { UpdateMeRequest, User } from "@/features/auth/types";
import { ApiClientError } from "@/lib/errors/api-error";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";
import type { TranslationKey } from "@/features/i18n/translations";

const NAME_MAX_LENGTH = 120;

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { setAuthenticatedUser } = useAuthSession();
  const { locale, t } = useI18n();
  const [name, setName] = useState(user.name || "");
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(user.name || "");
    setNameError(undefined);
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);
  }, [user.id]);

  const initialName = useMemo(() => normalizeOptionalText(user.name || ""), [user.name]);
  const currentName = useMemo(() => normalizeOptionalText(name), [name]);
  const isDirty = currentName !== initialName;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNameError = validateName(name, t);

    setNameError(nextNameError);
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);

    if (nextNameError) return;

    if (!isDirty) {
      setSuccessMessage(t("profile.noChanges"));
      return;
    }

    const payload: UpdateMeRequest = { name: currentName || null };
    setIsSubmitting(true);

    try {
      const response = await updateMe(payload);
      setAuthenticatedUser(response.user);
      setName(response.user.name || "");
      setSuccessMessage(t("profile.saved"));
    } catch (error) {
      setFormError(getProfileErrorMessage(error, t));
      setRequestId(getProfileRequestId(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setName(user.name || "");
    setNameError(undefined);
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);
  }

  return (
    <form
      className="profile-subsection profile-form profile-account-section"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="profile-subsection__header">
        <div>
          <h2 id="profile-details-heading">{t("profile.information")}</h2>
        </div>
        <span>{t("profile.emailReadOnly")}</span>
      </div>

      <dl className="profile-details" aria-labelledby="profile-details-heading">
        <ProfileDetail fallback={t("profile.notProvided")} label={t("profile.email")} value={user.email} />
        <ProfileDetail fallback={t("profile.notProvided")} label={t("profile.authProvider")} value={formatEnumValue(user.authProvider, t("profile.notProvided"))} />
        <ProfileDetail fallback={t("profile.notProvided")} label={t("profile.memberSince")} value={formatProfileDate(user.createdAt, locale, t("profile.notAvailable"))} />
      </dl>

      {formError ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{formError}</span>
          {requestId ? <small>{t("orders.request")} {requestId}</small> : null}
        </div>
      ) : null}

      {successMessage ? (
        <div className="customer-feedback customer-feedback--success" role="status">
          <CheckCircle2 aria-hidden="true" size={19} />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="profile-account-editable">
        <div className="form-field">
          <label htmlFor="profile-name">{t("profile.name")}</label>
          <input
            aria-describedby={nameError ? "profile-name-error" : undefined}
            aria-invalid={Boolean(nameError)}
            autoComplete="name"
            id="profile-name"
            maxLength={NAME_MAX_LENGTH}
            name="name"
            onChange={(event) => {
              setName(event.target.value);
              setSuccessMessage(undefined);
            }}
            placeholder={t("profile.namePlaceholder")}
            type="text"
            value={name}
          />
          <FieldError id="profile-name-error" message={nameError} />
          <p className="form-helper">
            {name.length}/{NAME_MAX_LENGTH} {t("profile.characters")}
          </p>
        </div>

        <div className="profile-form__actions">
          <button
            className="button button--primary"
            disabled={isSubmitting || !isDirty}
            type="submit"
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="spin" size={17} />
            ) : (
              <Save aria-hidden="true" size={17} />
            )}
            {isSubmitting ? t("profile.saving") : t("profile.save")}
          </button>
          <button
            className="button button--secondary"
            disabled={isSubmitting || !isDirty}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            {t("profile.reset")}
          </button>
        </div>
      </div>
    </form>
  );
}

function ProfileDetail({
  fallback,
  label,
  value,
}: {
  fallback: string;
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || fallback}</dd>
    </div>
  );
}

function normalizeOptionalText(value: string): string {
  return value.trim();
}

function validateName(
  value: string,
  t: (key: TranslationKey) => string,
): string | undefined {
  return value.length > NAME_MAX_LENGTH
    ? t("profile.nameTooLong")
    : undefined;
}

function formatEnumValue(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatProfileDate(
  value: string | null | undefined,
  locale: Locale,
  fallback: string,
): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { dateStyle: "medium" }).format(date);
}

function getProfileErrorMessage(
  error: unknown,
  t: (key: TranslationKey) => string,
): string {
  if (error instanceof ApiClientError) {
    const messageByCode: Record<string, string> = {
      AUTH_REQUIRED: t("profile.sessionRequired"),
      BAD_REQUEST: t("profile.nameInvalid"),
      NETWORK_ERROR: t("profile.apiUnavailable"),
      PROFILE_UPDATE_EMPTY: t("profile.changeBeforeSave"),
      VALIDATION_ERROR: t("profile.nameInvalid"),
    };
    return messageByCode[error.code] || error.message;
  }
  return t("profile.saveError");
}

function getProfileRequestId(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.requestId : undefined;
}
