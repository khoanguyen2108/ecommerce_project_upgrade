import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthenticatedAppGuard } from "@/components/auth/AuthenticatedAppGuard";
import { CartProvider } from "@/components/cart/CartProvider";
import { CustomerChatWidget } from "@/components/chat/CustomerChatWidget";
import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import { I18nProvider } from "@/features/i18n/I18nProvider";
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
        <I18nProvider>
          <AuthSessionProvider>
            <AuthenticatedAppGuard>
              <CartProvider>
                {children}
                <CustomerChatWidget />
              </CartProvider>
            </AuthenticatedAppGuard>
          </AuthSessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
