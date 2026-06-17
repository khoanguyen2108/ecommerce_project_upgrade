import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { CartPage } from "@/components/cart/CartPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Cart",
};

export default function CartRoutePage() {
  return (
    <>
      <SiteHeader active="cart" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme cart"
        returnPath="/cart"
        signInMessage="Sign in to view and update your cart."
        signInTitle="Cart sign-in required"
      >
        <CartPage />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
