"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/features/auth/api";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

type Status = "checking" | "confirmed" | "unconfirmed";

const SESSION_CONFIRMATION_ATTEMPTS = 3;
const SESSION_CONFIRMATION_RETRY_DELAY_MS = 400;

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

export function AuthSuccessStatus() {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuthSession();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let isMounted = true;
    let redirectTimer: number | undefined;

    async function confirmSession() {
      for (let attempt = 1; attempt <= SESSION_CONFIRMATION_ATTEMPTS; attempt += 1) {
        try {
          const response = await getCurrentUser();

          if (!isMounted) {
            return;
          }

          setAuthenticatedUser(response.user);
          setStatus("confirmed");
          redirectTimer = window.setTimeout(() => router.replace("/"), 1400);
          return;
        } catch {
          if (attempt < SESSION_CONFIRMATION_ATTEMPTS) {
            await wait(SESSION_CONFIRMATION_RETRY_DELAY_MS);
          }
        }
      }

      if (isMounted) {
        setStatus("unconfirmed");
      }
    }

    void confirmSession();

    return () => {
      isMounted = false;

      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [router, setAuthenticatedUser]);

  if (status === "checking") {
    return (
      <div className="status-panel" role="status">
        <LoaderCircle className="spin" size={28} />
        <h1>Checking your session</h1>
        <p>We are confirming your sign-in with Belikeme.</p>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="status-panel" role="status">
        <CheckCircle2 size={30} />
        <h1>Signed in successfully</h1>
        <p>Redirecting you back to the store.</p>
      </div>
    );
  }

  return (
    <div className="status-panel" role="status">
      <h1>Sign-in needs one more step</h1>
      <p>
        Google sign-in finished, but this browser could not confirm the session
        yet. You can return home or sign in with email.
      </p>
      <div className="status-panel__actions">
        <Link className="button button--primary" href="/login">
          Back to login
        </Link>
        <Link className="button button--secondary" href="/">
          Return home
        </Link>
      </div>
    </div>
  );
}
