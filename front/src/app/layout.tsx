import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Belikeme Clothing Store",
    template: "%s | Belikeme",
  },
  description:
    "Belikeme is a clothing store MVP for clean everyday apparel and simple account access.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
