"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  requestPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from "@/features/auth/api";
import { ApiClientError } from "@/lib/errors/api-error";
import { FieldError } from "@/components/ui/FieldError";

type ForgotPasswordStep = "request" | "verify" | "reset" | "success";
type PasswordResetAction = "request" | "verify" | "reset";

interface ForgotPasswordFieldErrors {
  email?: string;
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const GENERIC_REQUEST_MESSAGE =
  "If an account exists for that email, we sent a 6-digit reset code. It expires in about 60 seconds.";

export function ForgotPasswordFlow() {
  const [step, setStep] = useState<ForgotPasswordStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ForgotPasswordFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateEmail(email);
    setFieldErrors(nextErrors);
    setFormError(undefined);
    setNotice(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordResetOtp({
        email: email.trim(),
      });
      setOtp("");
      setStep("verify");
      setNotice(GENERIC_REQUEST_MESSAGE);
    } catch (error) {
      setFormError(getSafePasswordResetErrorMessage(error, "request"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasUsableEmail()) {
      return;
    }

    const nextErrors = validateOtp(otp);
    setFieldErrors(nextErrors);
    setFormError(undefined);
    setNotice(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyPasswordResetOtp({
        email: email.trim(),
        otp,
      });
      setNewPassword("");
      setConfirmPassword("");
      setStep("reset");
      setNotice("Code verified. Choose a new password to finish the reset.");
    } catch (error) {
      setFormError(getSafePasswordResetErrorMessage(error, "verify"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasUsableEmail()) {
      return;
    }

    const nextErrors = {
      ...validateOtp(otp),
      ...validatePasswordReset({ confirmPassword, newPassword }),
    };
    setFieldErrors(nextErrors);
    setFormError(undefined);
    setNotice(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        email: email.trim(),
        newPassword,
        otp,
      });
      setNewPassword("");
      setConfirmPassword("");
      setStep("success");
    } catch (error) {
      setFormError(getSafePasswordResetErrorMessage(error, "reset"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (!hasUsableEmail()) {
      return;
    }

    setIsResending(true);
    setFieldErrors({});
    setFormError(undefined);
    setNotice(undefined);

    try {
      await requestPasswordResetOtp({
        email: email.trim(),
      });
      setOtp("");
      setStep("verify");
      setNotice(GENERIC_REQUEST_MESSAGE);
    } catch (error) {
      setFormError(getSafePasswordResetErrorMessage(error, "request"));
    } finally {
      setIsResending(false);
    }
  }

  function handleUseDifferentEmail() {
    setStep("request");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setFormError(undefined);
    setNotice(undefined);
  }

  function hasUsableEmail(): boolean {
    const nextErrors = validateEmail(email);

    if (Object.keys(nextErrors).length > 0) {
      setStep("request");
      setFieldErrors(nextErrors);
      setFormError("Enter your email address again to continue.");
      setNotice(undefined);
      return false;
    }

    return true;
  }

  if (step === "success") {
    return (
      <div className="auth-card" aria-labelledby="forgot-password-success-heading">
        <div className="auth-card__heading">
          <CheckCircle2 className="auth-status-icon" size={32} />
          <h1 id="forgot-password-success-heading">Password updated</h1>
          <p>Your password has been reset. You can now sign in with the new password.</p>
        </div>

        <Link className="button button--primary button--full auth-card__primary-link" href="/login">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card" aria-labelledby="forgot-password-heading">
      <div className="auth-card__heading">
        <p className="auth-step">{getStepLabel(step)}</p>
        <h1 id="forgot-password-heading">Reset password</h1>
        <p>{getStepIntro(step, email)}</p>
      </div>

      {notice ? (
        <div className="form-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      ) : null}

      {formError ? (
        <div className="form-alert" role="alert">
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      {step === "request" ? (
        <form className="auth-form" noValidate onSubmit={handleRequestOtp}>
          <div className="form-field">
            <label htmlFor="forgot-email">Email address</label>
            <input
              aria-describedby={fieldErrors.email ? "forgot-email-error" : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              id="forgot-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
            <FieldError id="forgot-email-error" message={fieldErrors.email} />
          </div>

          <button
            className="button button--primary button--full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Sending code..." : "Send reset code"}
          </button>
        </form>
      ) : null}

      {step === "verify" ? (
        <form className="auth-form" noValidate onSubmit={handleVerifyOtp}>
          <div className="form-field">
            <label htmlFor="forgot-otp">6-digit code</label>
            <input
              aria-describedby={fieldErrors.otp ? "forgot-otp-error" : "forgot-otp-help"}
              aria-invalid={Boolean(fieldErrors.otp)}
              autoComplete="one-time-code"
              id="forgot-otp"
              inputMode="numeric"
              maxLength={6}
              name="otp"
              onChange={(event) => setOtp(cleanOtpInput(event.target.value))}
              pattern="\\d{6}"
              placeholder="123456"
              type="text"
              value={otp}
            />
            <p className="form-helper" id="forgot-otp-help">
              Codes expire quickly, so request a fresh one if 60 seconds have passed.
            </p>
            <FieldError id="forgot-otp-error" message={fieldErrors.otp} />
          </div>

          <button
            className="button button--primary button--full"
            disabled={isSubmitting || isResending}
            type="submit"
          >
            {isSubmitting ? "Checking code..." : "Verify code"}
          </button>

          <div className="auth-inline-actions">
            <button
              className="text-link"
              disabled={isSubmitting || isResending}
              onClick={handleResendOtp}
              type="button"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
            <button
              className="text-link"
              disabled={isSubmitting || isResending}
              onClick={handleUseDifferentEmail}
              type="button"
            >
              Use a different email
            </button>
          </div>
        </form>
      ) : null}

      {step === "reset" ? (
        <form className="auth-form" noValidate onSubmit={handleResetPassword}>
          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <div className="password-field">
              <input
                aria-describedby={
                  fieldErrors.newPassword ? "new-password-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.newPassword)}
                autoComplete="new-password"
                id="new-password"
                name="newPassword"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
              />
              <button
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                className="password-toggle"
                onClick={() => setShowNewPassword((value) => !value)}
                type="button"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FieldError id="new-password-error" message={fieldErrors.newPassword} />
          </div>

          <div className="form-field">
            <label htmlFor="confirm-new-password">Confirm password</label>
            <div className="password-field">
              <input
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? "confirm-new-password-error"
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                autoComplete="new-password"
                id="confirm-new-password"
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="password-toggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
                type="button"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FieldError
              id="confirm-new-password-error"
              message={fieldErrors.confirmPassword}
            />
          </div>

          <button
            className="button button--primary button--full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Updating password..." : "Update password"}
          </button>

          <div className="auth-inline-actions">
            <button
              className="text-link"
              disabled={isSubmitting || isResending}
              onClick={handleResendOtp}
              type="button"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
            <button
              className="text-link"
              disabled={isSubmitting}
              onClick={() => setStep("verify")}
              type="button"
            >
              Re-enter code
            </button>
          </div>
        </form>
      ) : null}

      <p className="auth-switch">
        Remembered your password? <Link href="/login">Back to login</Link>
      </p>
    </div>
  );
}

function validateEmail(email: string): ForgotPasswordFieldErrors {
  const errors: ForgotPasswordFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = "Email is required.";
  } else if (trimmedEmail.length > 320) {
    errors.email = "Email must be 320 characters or less.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

function validateOtp(otp: string): ForgotPasswordFieldErrors {
  const errors: ForgotPasswordFieldErrors = {};

  if (!otp) {
    errors.otp = "Enter the 6-digit code.";
  } else if (!/^\d{6}$/.test(otp)) {
    errors.otp = "Code must be exactly 6 digits.";
  }

  return errors;
}

function validatePasswordReset(values: {
  newPassword: string;
  confirmPassword: string;
}): ForgotPasswordFieldErrors {
  const errors: ForgotPasswordFieldErrors = {};

  if (!values.newPassword) {
    errors.newPassword = "New password is required.";
  } else if (values.newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters.";
  } else if (values.newPassword.length > 128) {
    errors.newPassword = "Password must be 128 characters or less.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your new password.";
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function cleanOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

function getStepLabel(step: ForgotPasswordStep): string {
  if (step === "request") {
    return "Step 1 of 3";
  }

  if (step === "verify") {
    return "Step 2 of 3";
  }

  return "Step 3 of 3";
}

function getStepIntro(step: ForgotPasswordStep, email: string): string {
  if (step === "request") {
    return "Enter your email and we will send reset instructions if the account exists.";
  }

  if (step === "verify") {
    return `Check ${email.trim()} for the code. Keep the newest code handy; it expires in about 60 seconds.`;
  }

  return "Choose a new password. If the code has expired, request a fresh one before trying again.";
}

function getSafePasswordResetErrorMessage(
  error: unknown,
  action: PasswordResetAction,
): string {
  if (error instanceof ApiClientError) {
    if (error.code === "API_BASE_URL_MISSING" || error.code === "NETWORK_ERROR") {
      return error.message;
    }

    if (error.status === 429) {
      return "Too many attempts right now. Please wait a moment before trying again.";
    }
  }

  if (action === "request") {
    return "We could not send a reset code right now. Please try again in a moment.";
  }

  if (action === "verify") {
    return "That code is invalid or expired. Please check it or request a new one.";
  }

  return "Password reset could not be completed. Please request a fresh code and try again.";
}
