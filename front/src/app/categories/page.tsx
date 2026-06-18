import type { Metadata } from "next";
import { CategoriesPage } from "@/components/catalog/CategoriesPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse Belikeme clothing by category.",
};

export default function CategoriesRoute() {
  return (
    <>
      <SiteHeader active="categories" />
      <CategoriesPage />
      <SiteFooter />
    </>
  );
}
