"use client";

import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { currentUser, logout } = useAuthSession();
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
          <Link className="brand-mark" href="/admin" aria-label="Belikeme admin home">
            BELIKEME
          </Link>
          <span>Admin</span>
        </div>

        <AdminNav />
      </aside>

      <div className="admin-shell__workspace">
        <header className="admin-topbar">
          <div className="admin-topbar__identity">
            <span>{currentUser?.name || "Admin"}</span>
            <small>{currentUser?.email}</small>
          </div>

          <div className="admin-topbar__actions">
            <Link className="admin-store-link" href="/products">
              <Store aria-hidden="true" size={17} strokeWidth={1.8} />
              Storefront
            </Link>
            <button
              aria-label="Sign out"
              className="icon-button admin-icon-button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              title="Sign out"
              type="button"
            >
              <LogOut size={20} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className="admin-shell__content">{children}</main>
      </div>
    </div>
  );
}
