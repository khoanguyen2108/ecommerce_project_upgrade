import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/catalog/ProductDetailPage";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Product detail",
};

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  return (
    <>
      <SiteHeader active="shop" />
      <ProductDetailPage productRef={id} />
      <SiteFooter />
    </>
  );
}
