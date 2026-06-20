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

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { setAuthenticatedUser } = useAuthSession();
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
    const nextNameError = validateName(name);

    setNameError(nextNameError);
    setFormError(undefined);
    setRequestId(undefined);
    setSuccessMessage(undefined);

    if (nextNameError) return;

    if (!isDirty) {
      setSuccessMessage("No profile changes to save.");
      return;
    }

    const payload: UpdateMeRequest = { name: currentName || null };
    setIsSubmitting(true);

    try {
      const response = await updateMe(payload);
      setAuthenticatedUser(response.user);
      setName(response.user.name || "");
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
          <p className="eyebrow">Account information</p>
          <h2 id="profile-details-heading">Account information</h2>
        </div>
        <span>Email details are read only</span>
      </div>

      <dl className="profile-details" aria-labelledby="profile-details-heading">
        <ProfileDetail label="Email" value={user.email} />
        <ProfileDetail label="Auth provider" value={formatEnumValue(user.authProvider)} />
        <ProfileDetail label="Member since" value={formatProfileDate(user.createdAt)} />
      </dl>

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

      <div className="profile-account-editable">
        <div className="form-field">
          <label htmlFor="profile-name">Name</label>
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
            placeholder="Your name"
            type="text"
            value={name}
          />
          <FieldError id="profile-name-error" message={nameError} />
          <p className="form-helper">
            {name.length}/{NAME_MAX_LENGTH} characters
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
      </div>
    </form>
  );
}

function ProfileDetail({ label, value }: { label: string; value?: string | null }) {
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

function validateName(value: string): string | undefined {
  return value.length > NAME_MAX_LENGTH
    ? `Name must be ${NAME_MAX_LENGTH} characters or fewer.`
    : undefined;
}

function formatEnumValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatProfileDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function getProfileErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const messageByCode: Record<string, string> = {
      AUTH_REQUIRED: "Your session is required. Sign in again to update profile.",
      BAD_REQUEST: "Your profile name is invalid. Review it and try again.",
      NETWORK_ERROR: "The profile API could not be reached. Check the backend and retry.",
      PROFILE_UPDATE_EMPTY: "Change your name before saving.",
      VALIDATION_ERROR: "Your profile name is invalid. Review it and try again.",
    };
    return messageByCode[error.code] || error.message;
  }
  return "Profile could not be saved. Please try again.";
}

function getProfileRequestId(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.requestId : undefined;
}
