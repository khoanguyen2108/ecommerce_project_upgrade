import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OrdersPage } from "@/components/orders/OrdersPage";
import type { OrderQuery, OrderStatus } from "@/features/orders/types";

export const metadata: Metadata = {
  title: "Orders",
};

interface OrdersRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrdersRoute({ searchParams }: OrdersRouteProps) {
  const params = searchParams ? await searchParams : {};
  const initialQuery = parseInitialQuery(params);

  return (
    <>
      <SiteHeader active="orders" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme orders"
        returnPath={buildReturnPath(initialQuery)}
        signInMessage="Sign in to view orders visible to your account."
        signInTitle="Order sign-in required"
      >
        <OrdersPage initialQuery={initialQuery} />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}

function parseInitialQuery(
  params: Record<string, string | string[] | undefined>,
): OrderQuery {
  return {
    limit: 10,
    page: parsePositiveInteger(getFirst(params.page)) || 1,
    status: parseOrderStatus(getFirst(params.status)),
  };
}

function buildReturnPath(query: OrderQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) {
    params.set("page", String(query.page));
  }

  if (query.status) {
    params.set("status", query.status);
  }

  const queryString = params.toString();

  return queryString ? `/orders?${queryString}` : "/orders";
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOrderStatus(value: string | undefined): OrderStatus | undefined {
  if (
    value === "PENDING_PAYMENT" ||
    value === "PAID" ||
    value === "CANCELLED" ||
    value === "EXPIRED"
  ) {
    return value;
  }

  return undefined;
}
