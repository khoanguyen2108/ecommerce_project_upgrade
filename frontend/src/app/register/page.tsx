import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <>
      <SiteHeader active="account" />
      <main className="auth-page">
        <RegisterForm />
      </main>
      <SiteFooter />
    </>
  );
}
