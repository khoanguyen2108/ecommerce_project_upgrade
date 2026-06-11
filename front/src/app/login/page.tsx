import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Sign in",
};

interface LoginPageProps {
  searchParams?: Promise<{
    registered?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const registered = Array.isArray(params.registered)
    ? params.registered.includes("1")
    : params.registered === "1";

  return (
    <>
      <SiteHeader active="account" />
      <main className="auth-page">
        <LoginForm registered={registered} />
      </main>
      <SiteFooter />
    </>
  );
}
