import type { Metadata } from "next";
import { AdminLandingPage } from "@/components/admin-landing/AdminLandingPage";

export const metadata: Metadata = {
  title: "Landing Page",
};

export default function LandingAdminPage() {
  return <AdminLandingPage />;
}
