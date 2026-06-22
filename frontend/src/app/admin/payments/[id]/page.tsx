import type { Metadata } from "next";
import { AdminPaymentDetailPage } from "@/components/admin-payments/AdminPaymentDetailPage";

export const metadata: Metadata = { title: "Payment detail" };

export default async function AdminPaymentDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPaymentDetailPage paymentId={id} />;
}
