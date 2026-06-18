import type { Metadata } from "next";
import { PayosReadinessPage } from "@/components/admin-payments/PayosReadinessPage";

export const metadata: Metadata = { title: "payOS Readiness" };

export default function PayosReadinessRoute() {
  return <PayosReadinessPage />;
}
