"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { startGoogleLogin, loginUser } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { getPostLoginRedirectPath } from "@/features/auth/roles";
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";
import { FieldError } from "@/components/ui/FieldError";
import { GoogleMark } from "@/components/ui/GoogleMark";

interface LoginFormProps {
  nextPath?: string;
  registered?: boolean;
}

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ nextPath, registered }: LoginFormProps) {
  const router = useRouter();
  const { setAuthenticatedSession } = useAuthSession();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLogin({ email, password }, t);
    setFieldErrors(nextErrors);
    setFormError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: email.trim(),
        password,
      });
      setAuthenticatedSession(response);
      router.push(getPostLoginRedirectPath(response.user, nextPath || "/"));
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
    <div className="auth-card" aria-labelledby="login-heading">
      <div className="auth-card__heading">
        <h1 id="login-heading">{t("auth.loginTitle")}</h1>
        <p>{t("auth.loginSubtitle")}</p>
      </div>

      {registered ? (
        <div className="form-success" role="status">
          {t("auth.registerSuccess")}
        </div>
      ) : null}

      {formError ? (
        <div className="form-alert" role="alert">
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">{t("auth.email")}</label>
          <input
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            type="email"
            value={email}
          />
          <FieldError id="email-error" message={fieldErrors.email} />
        </div>

        <div className="form-field">
          <div className="form-field__label-row">
            <label htmlFor="password">Password</label>
            <Link className="text-link" href="/forgot-password">
              {t("auth.forgot")}
            </Link>
          </div>
          <div className="password-field">
            <input
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
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
          <FieldError id="password-error" message={fieldErrors.password} />
        </div>

        <button
          className="button button--primary button--full"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t("auth.orContinueWith")}</span>
      </div>

      <button className="button button--google" onClick={handleGoogleLogin} type="button">
        <GoogleMark />
        Google
      </button>

      <p className="auth-switch">
        {t("auth.noAccount")} <Link href="/register">{t("auth.createAccount")}</Link>
      </p>
    </div>
  );
}

function validateLogin(
  values: { email: string; password: string },
  t: ReturnType<typeof useI18n>["t"],
): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = t("auth.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = t("auth.emailInvalid");
  }

  if (!values.password) {
    errors.password = t("auth.passwordRequired");
  } else if (values.password.length < 8) {
    errors.password = t("auth.passwordMin");
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

  return t("auth.loginError");
}
