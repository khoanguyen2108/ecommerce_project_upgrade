"use client";

import { LogOut, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { AdminLanguageSwitcher } from "@/features/i18n/AdminLanguageSwitcher";
import { useAdminCommonI18n } from "@/features/i18n/admin-common-translations";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { currentUser, logout } = useAuthSession();
  const { messages } = useAdminCommonI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await logout();
    router.push("/");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <Link
            className="brand-mark"
            href="/admin"
            aria-label={messages.shell.adminHomeLabel}
          >
            BELIKEME
          </Link>
          <span>{messages.shell.managementConsole}</span>
        </div>

        <AdminNav />

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__language">
            <span>{messages.shell.language}</span>
            <AdminLanguageSwitcher />
          </div>

          <Link className="admin-store-link" href="/">
            <Store aria-hidden="true" size={17} strokeWidth={1.8} />
            {messages.shell.storefront}
          </Link>

          <div className="admin-sidebar__account">
            <span className="admin-sidebar__avatar" aria-hidden="true">
              <UserRound size={18} strokeWidth={1.8} />
            </span>
            <div className="admin-topbar__identity">
              <span>{currentUser?.name || messages.common.admin}</span>
              <small>{currentUser?.email}</small>
            </div>
            <button
              aria-label={messages.shell.signOut}
              className="admin-signout-button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              title={messages.shell.signOut}
              type="button"
            >
              <LogOut aria-hidden="true" size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-shell__workspace">
        <main className="admin-shell__content">{children}</main>
      </div>
    </div>
  );
}
