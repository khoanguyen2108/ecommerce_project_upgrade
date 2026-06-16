import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OrderDetailPage } from "@/components/orders/OrderDetailPage";

export const metadata: Metadata = {
  title: "Order detail",
};

interface OrderDetailRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailRoute({ params }: OrderDetailRouteProps) {
  const { id } = await params;

  return (
    <>
      <SiteHeader active="orders" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme orders"
        returnPath={`/orders/${encodeURIComponent(id)}`}
        signInMessage="Sign in to view this order if it is visible to your account."
        signInTitle="Order sign-in required"
      >
        <OrderDetailPage orderId={id} />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}
