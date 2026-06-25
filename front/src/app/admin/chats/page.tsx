import type { Metadata } from "next";
import { AdminChatsPage } from "@/components/admin-chats/AdminChatsPage";

export const metadata: Metadata = {
  title: "Chats",
};

export default function AdminChatsRoute() {
  return <AdminChatsPage />;
}
