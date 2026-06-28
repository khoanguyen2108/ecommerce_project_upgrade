import type { Metadata } from "next";
import { StyleAssistant } from "@/components/ai/StyleAssistant";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "AI Style Assistant",
  description:
    "Create a personalized outfit edit from Belikeme's current catalog.",
};

export default function StyleAssistantPage() {
  return (
    <>
      <SiteHeader active="ai" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme AI Style Assistant"
        returnPath="/ai/style-assistant"
        signInMessage="Sign in to create a personalized edit from Belikeme's live catalog."
        signInTitle="Style assistant sign-in required"
      >
        <StyleAssistant />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
