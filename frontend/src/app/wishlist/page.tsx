import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { WishlistPage } from "@/components/wishlist/WishlistPage";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default function WishlistRoutePage() {
  return (
    <>
      <SiteHeader active="wishlist" />
      <WishlistPage />
      <SiteFooter />
    </>
  );
}

