import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Categories",
};

export default function LandingAdminPage() {
  redirect("/admin/categories");
}
