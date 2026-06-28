import type { Metadata } from "next";
import { ProductRecommendations } from "@/components/ai/ProductRecommendations";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "AI Product Recommendations",
  description:
    "Describe what you need and discover matching products from Belikeme's current catalog.",
};

export default function ProductRecommendationsPage() {
  return (
    <>
      <SiteHeader active="ai-recommendations" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme AI Product Recommendations"
        returnPath="/ai/recommendations"
        signInMessage="Sign in to find matching products from Belikeme's live catalog."
        signInTitle="Product recommendation sign-in required"
      >
        <ProductRecommendations />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
