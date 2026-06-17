import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { CheckoutPage } from "@/components/checkout/CheckoutPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutRoutePage() {
  return (
    <>
      <SiteHeader active="cart" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme checkout"
        returnPath="/checkout"
        signInMessage="Sign in to create a pending-payment order from your cart."
        signInTitle="Checkout sign-in required"
      >
        <CheckoutPage />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
