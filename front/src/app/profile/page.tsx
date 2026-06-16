import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ProfilePage } from "@/components/profile/ProfilePage";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfileRoute() {
  return (
    <>
      <SiteHeader active="account" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme profile"
        returnPath="/profile"
        signInMessage="Sign in to view and update your Belikeme profile."
        signInTitle="Profile sign-in required"
      >
        <ProfilePage />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
