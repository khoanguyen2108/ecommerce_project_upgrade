"use client";

import { LogOut, UserRound } from "lucide-react";
import Image from "next/image";
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
          <Link
            className="brand-mark brand-mark--image admin-sidebar__brand-mark"
            href="/admin"
            aria-label={"Belikeme admin home"}
          >
            <Image
              alt=""
              aria-hidden="true"
              className="admin-sidebar__brand-logo"
              height={457}
              priority
              src="/images/brand/belikeme-logo.png"
              width={1098}
            />
          </Link>
          <span>{"Management Console"}</span>
        </div>

        <AdminNav />

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__store-row">
            <Link className="admin-store-link" href="/">
              {"Storefront"}
            </Link>
            <div className="admin-sidebar__language">
            </div>
          </div>

          <div className="admin-sidebar__account">
            <span className="admin-sidebar__avatar" aria-hidden="true">
              <UserRound size={18} strokeWidth={1.8} />
            </span>
            <div className="admin-topbar__identity">
              <span>{currentUser?.name || "Admin"}</span>
              <small>{currentUser?.email}</small>
            </div>
            <button
              aria-label={"Sign out"}
              className="admin-signout-button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              title={"Sign out"}
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
