"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { startGoogleLogin, loginUser } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLogin({ email, password });
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
      router.push(nextPath || "/");
    } catch (error) {
      setFormError(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    try {
      startGoogleLogin();
    } catch (error) {
      setFormError(getSafeErrorMessage(error));
    }
  }

  return (
    <div className="auth-card" aria-labelledby="login-heading">
      <div className="auth-card__heading">
        <h1 id="login-heading">Welcome back</h1>
        <p>Enter your details to continue shopping your saved edit.</p>
      </div>

      {registered ? (
        <div className="form-success" role="status">
          Your account was created. Sign in to continue.
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
          <label htmlFor="email">Email address</label>
          <input
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            type="email"
            value={email}
          />
          <FieldError id="email-error" message={fieldErrors.email} />
        </div>

        <div className="form-field">
          <div className="form-field__label-row">
            <label htmlFor="password">Password</label>
            <Link className="text-link" href="/forgot-password">
              Forgot?
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
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
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
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>Or continue with</span>
      </div>

      <button className="button button--google" onClick={handleGoogleLogin} type="button">
        <GoogleMark />
        Google
      </button>

      <p className="auth-switch">
        Do not have an account? <Link href="/register">Create account</Link>
      </p>
    </div>
  );
}

function validateLogin(values: { email: string; password: string }): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (process.env.NODE_ENV === "development" && error.requestId) {
      return `${error.message} Request ID: ${error.requestId}`;
    }

    return error.message;
  }

  return "Sign in could not be completed. Please try again.";
}
