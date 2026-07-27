"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerUser, startGoogleLogin } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
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
    <div className="auth-card" aria-labelledby="register-heading">
      <div className="auth-card__heading">
        <h1 id="register-heading">{"Create account"}</h1>
        <p>{"Join Belikeme and keep your wardrobe picks in one place."}</p>
      </div>

      {formError ? (
        <div className="form-alert" role="alert">
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      ) : null}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="name">{"Full name"}</label>
          <input
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            autoComplete="name"
            id="name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder={"Jane Doe"}
            type="text"
            value={name}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
        </div>

        <div className="form-field">
          <label htmlFor="email">{"Email address"}</label>
          <input
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={"name@example.com"}
            type="email"
            value={email}
          />
          <FieldError id="register-email-error" message={fieldErrors.email} />
        </div>

        <div className="form-field">
          <label htmlFor="password">{"Password"}</label>
          <div className="password-field">
            <input
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={"At least 8 characters"}
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={
                showPassword ? "Hide password" : "Show password"
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
          <label htmlFor="confirmPassword">{"Confirm password"}</label>
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
              placeholder={"Repeat your password"}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              aria-label={
                showConfirmPassword
                  ? "Hide password"
                  : "Show password"
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="auth-divider">
        <span>{"Or sign up with"}</span>
      </div>

      <button className="button button--google" onClick={handleGoogleLogin} type="button">
        <GoogleMark />
        Google
      </button>

      <p className="auth-switch">
        {"Already have an account?"} <Link href="/login">{"Sign in"}</Link>
      </p>
    </div>
  );
}

function validateRegister(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  } else if (values.name.trim().length > 120) {
    errors.name = "Name must be 120 characters or less.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (values.password.length > 128) {
    errors.password = "Password must be 128 characters or less.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function getSafeErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiClientError) {
    if (process.env.NODE_ENV === "development" && error.requestId) {
      return `${error.message} Request ID: ${error.requestId}`;
    }

    return error.message;
  }

  return "Account creation could not be completed. Please try again.";
}
