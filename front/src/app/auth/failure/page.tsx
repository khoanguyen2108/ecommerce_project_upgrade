import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Sign-in failed",
};

export default function AuthFailurePage() {
  return (
    <>
      <SiteHeader active="account" />
      <main className="auth-page auth-page--compact">
        <div className="status-panel" role="status">
          <h1>We could not finish sign-in</h1>
          <p>
            Google sign-in was not completed. Please try again or sign in with
            email.
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
      </main>
    </>
  );
}
