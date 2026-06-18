import type { Metadata } from "next";
import { AdminOrderDetailPage } from "@/components/admin-orders/AdminOrderDetailPage";

export const metadata: Metadata = { title: "Order detail" };

export default async function AdminOrderDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailPage orderId={id} />;
}
