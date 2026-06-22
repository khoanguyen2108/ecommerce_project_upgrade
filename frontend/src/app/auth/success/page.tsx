import type { Metadata } from "next";
import { AuthSuccessStatus } from "@/components/auth/AuthSuccessStatus";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Sign-in confirmation",
};

export default function AuthSuccessPage() {
  return (
    <>
      <SiteHeader active="account" />
      <main className="auth-page auth-page--compact">
        <AuthSuccessStatus />
      </main>
    </>
  );
}
