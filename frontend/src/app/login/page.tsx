import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Sign in",
};

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string | string[];
    registered?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const registered = getFirst(params.registered) === "1";
  const nextPath = getSafeLocalNext(getFirst(params.next));

  return (
    <>
      <SiteHeader active="account" />
      <main className="auth-page">
        <LoginForm nextPath={nextPath} registered={registered} />
      </main>
      <SiteFooter />
    </>
  );
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getSafeLocalNext(value: string | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  if (value.includes("\\") || value.startsWith("/login")) {
    return undefined;
  }

  return value;
}
