import type { Metadata } from "next";
import { AdminDashboardPage } from "@/components/admin-dashboard/AdminDashboardPage";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminPage() {
  return <AdminDashboardPage />;
}
