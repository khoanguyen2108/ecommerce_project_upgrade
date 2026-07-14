"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerUser, startGoogleLogin } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";
import { FieldError } from "@/components/ui/FieldError";
import { GoogleMark } from "@/components/ui/GoogleMark";

interface RegisterFieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const { setAuthenticatedSession } = useAuthSession();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateRegister(
      {
        confirmPassword,
        email,
        name,
        password,
      },
      t,
    );
    setFieldErrors(nextErrors);
    setFormError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerUser({
        email: email.trim(),
        name: name.trim(),
        password,
      });
      setAuthenticatedSession(response);
      router.push("/");
    } catch (error) {
      setFormError(getSafeErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    try {
      startGoogleLogin();
    } catch (error) {
      setFormError(getSafeErrorMessage(error, t));
    }
  }

  return (
    <div className="auth-card" aria-labelledby="register-heading">
      <div className="auth-card__heading">
        <h1 id="register-heading">{t("auth.registerTitle")}</h1>
        <p>{t("auth.registerSubtitle")}</p>
      </div>

      {formError ? (
        <div className="form-alert" role="alert">
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="name">{t("auth.fullName")}</label>
          <input
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            autoComplete="name"
            id="name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder={t("auth.fullNamePlaceholder")}
            type="text"
            value={name}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
        </div>

        <div className="form-field">
          <label htmlFor="email">{t("auth.email")}</label>
          <input
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            type="email"
            value={email}
          />
          <FieldError id="register-email-error" message={fieldErrors.email} />
        </div>

        <div className="form-field">
          <label htmlFor="password">{t("auth.password")}</label>
          <div className="password-field">
            <input
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordNewPlaceholder")}
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={
                showPassword ? t("auth.hidePassword") : t("auth.showPassword")
              }
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError id="register-password-error" message={fieldErrors.password} />
        </div>

        <div className="form-field">
          <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
          <div className="password-field">
            <input
              aria-describedby={
                fieldErrors.confirmPassword ? "confirm-password-error" : undefined
              }
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              id="confirmPassword"
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              aria-label={
                showConfirmPassword
                  ? t("auth.hidePassword")
                  : t("auth.showPassword")
              }
              className="password-toggle"
              onClick={() => setShowConfirmPassword((value) => !value)}
              type="button"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError
            id="confirm-password-error"
            message={fieldErrors.confirmPassword}
          />
        </div>

        <button
          className="button button--primary button--full"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t("auth.orSignUpWith")}</span>
      </div>

      <button className="button button--google" onClick={handleGoogleLogin} type="button">
        <GoogleMark />
        Google
      </button>

      <p className="auth-switch">
        {t("auth.haveAccount")} <Link href="/login">{t("auth.signIn")}</Link>
      </p>
    </div>
  );
}

function validateRegister(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}, t: ReturnType<typeof useI18n>["t"]): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = t("auth.nameRequired");
  } else if (values.name.trim().length > 120) {
    errors.name = t("auth.nameMax");
  }

  if (!values.email.trim()) {
    errors.email = t("auth.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = t("auth.emailInvalid");
  }

  if (!values.password) {
    errors.password = t("auth.passwordRequired");
  } else if (values.password.length < 8) {
    errors.password = t("auth.passwordMin");
  } else if (values.password.length > 128) {
    errors.password = t("auth.passwordMax");
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = t("auth.confirmRequired");
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = t("auth.passwordMismatch");
  }

  return errors;
}

function getSafeErrorMessage(
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (error instanceof ApiClientError) {
    if (process.env.NODE_ENV === "development" && error.requestId) {
      return `${error.message} Request ID: ${error.requestId}`;
    }

    return error.message;
  }

  return t("auth.registerError");
}
