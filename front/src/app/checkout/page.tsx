import type { Metadata } from "next";
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
      <CheckoutPage />
      <SiteFooter />
    </>
  );
}
