import type { Metadata } from "next";
import { CategoryDetailPage } from "@/components/catalog/CategoryDetailPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Category",
};

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  return (
    <>
      <SiteHeader active="shop" />
      <CategoryDetailPage slug={slug} />
      <SiteFooter />
    </>
  );
}
