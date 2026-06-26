import type { Metadata } from "next";
import { AdminLandingGalleryPage } from "@/components/admin-landing-gallery/AdminLandingGalleryPage";

export const metadata: Metadata = {
  title: "Landing Gallery",
};

export default function AdminLandingGalleryRoute() {
  return <AdminLandingGalleryPage />;
}
