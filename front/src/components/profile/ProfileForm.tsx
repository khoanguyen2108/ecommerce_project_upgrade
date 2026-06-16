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

const NAME_MAX_LENGTH = 120;
const PHONE_MAX_LENGTH = 32;

interface ProfileFormProps {
  user: User;
}

interface ProfileFieldErrors {
  name?: string;
  phone?: string;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { setAuthenticatedUser } = useAuthSession();
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(user.name || "");
    setPhone(user.phone || "");
    setFieldErrors({});
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);
  }, [user.id]);

  const initialValues = useMemo(
    () => ({
      name: normalizeOptionalText(user.name || ""),
      phone: normalizeOptionalText(user.phone || ""),
    }),
    [user.name, user.phone],
  );

  const currentValues = useMemo(
    () => ({
      name: normalizeOptionalText(name),
      phone: normalizeOptionalText(phone),
    }),
    [name, phone],
  );

  const isDirty =
    currentValues.name !== initialValues.name ||
    currentValues.phone !== initialValues.phone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateProfileFields({ name, phone });
    setFieldErrors(nextErrors);
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: UpdateMeRequest = {};

    if (currentValues.name !== initialValues.name) {
      payload.name = currentValues.name || null;
    }

    if (currentValues.phone !== initialValues.phone) {
      payload.phone = currentValues.phone || null;
    }

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("No profile changes to save.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await updateMe(payload);
      setAuthenticatedUser(response.user);
      setName(response.user.name || "");
      setPhone(response.user.phone || "");
      setSuccessMessage("Profile saved.");
    } catch (error) {
      setFormError(getProfileErrorMessage(error));
      setRequestId(getProfileRequestId(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setName(user.name || "");
    setPhone(user.phone || "");
    setFieldErrors({});
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);
  }

  return (
    <section className="profile-grid" aria-label="Profile settings">
      <section className="profile-panel" aria-labelledby="profile-details-heading">
        <div className="profile-panel__header">
          <div>
            <p className="eyebrow">Current profile</p>
            <h2 id="profile-details-heading">Account details</h2>
          </div>
          <span>Read-only fields are locked</span>
        </div>

        <dl className="profile-details">
          <ProfileDetail label="Email" value={user.email} />
          <ProfileDetail label="Name" value={user.name} />
          <ProfileDetail label="Phone" value={user.phone} />
          <ProfileDetail label="Role" value={formatEnumValue(user.role)} />
          <ProfileDetail
            label="Auth provider"
            value={formatEnumValue(user.authProvider)}
          />
        </dl>
      </section>

      <form className="profile-panel profile-form" noValidate onSubmit={handleSubmit}>
        <div className="profile-panel__header">
          <div>
            <p className="eyebrow">Editable</p>
            <h2>Contact settings</h2>
          </div>
          <span>Name and phone only</span>
        </div>

        {formError ? (
          <div className="customer-feedback customer-feedback--error" role="alert">
            <AlertCircle aria-hidden="true" size={19} />
            <span>{formError}</span>
            {requestId ? <small>Request {requestId}</small> : null}
          </div>
        ) : null}

        {successMessage ? (
          <div className="customer-feedback customer-feedback--success" role="status">
            <CheckCircle2 aria-hidden="true" size={19} />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <div className="form-field">
          <label htmlFor="profile-name">Name</label>
          <input
            aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            autoComplete="name"
            id="profile-name"
            maxLength={NAME_MAX_LENGTH}
            name="name"
            onChange={(event) => {
              setName(event.target.value);
              setSuccessMessage(undefined);
            }}
            placeholder="Belikeme Customer"
            type="text"
            value={name}
          />
          <FieldError id="profile-name-error" message={fieldErrors.name} />
          <p className="form-helper">
            {name.length}/{NAME_MAX_LENGTH} characters
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="profile-phone">Phone</label>
          <input
            aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined}
            aria-invalid={Boolean(fieldErrors.phone)}
            autoComplete="tel"
            id="profile-phone"
            maxLength={PHONE_MAX_LENGTH}
            name="phone"
            onChange={(event) => {
              setPhone(event.target.value);
              setSuccessMessage(undefined);
            }}
            placeholder="+84901234567"
            type="tel"
            value={phone}
          />
          <FieldError id="profile-phone-error" message={fieldErrors.phone} />
          <p className="form-helper">
            {phone.length}/{PHONE_MAX_LENGTH} characters
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
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button
            className="button button--secondary"
            disabled={isSubmitting || !isDirty}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}

function ProfileDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not provided"}</dd>
    </div>
  );
}

function normalizeOptionalText(value: string): string {
  return value.trim();
}

function validateProfileFields(values: {
  name: string;
  phone: string;
}): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (values.name.length > NAME_MAX_LENGTH) {
    errors.name = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (values.phone.length > PHONE_MAX_LENGTH) {
    errors.phone = `Phone must be ${PHONE_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

function formatEnumValue(value: string | null | undefined): string {
  if (!value) {
    return "Not provided";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const messageByCode: Record<string, string> = {
      AUTH_REQUIRED: "Your session is required. Sign in again to update profile.",
      BAD_REQUEST: "Some profile details are invalid. Review the form and try again.",
      NETWORK_ERROR:
        "The profile API could not be reached. Check the backend and retry.",
      PROFILE_UPDATE_EMPTY: "Change your name or phone before saving.",
      VALIDATION_ERROR: "Some profile details are invalid. Review the form and try again.",
    };

    return messageByCode[error.code] || error.message;
  }

  return "Profile could not be saved. Please try again.";
}

function getProfileRequestId(error: unknown): string | undefined {
  if (error instanceof ApiClientError) {
    return error.requestId;
  }

  return undefined;
}
