"use client";

import { Info, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AddressBook } from "@/components/profile/AddressBook";

export function ProfilePage() {
  const { currentUser } = useAuthSession();

  if (!currentUser) {
    return (
      <main className="account-state-page">
        <section
          aria-labelledby="profile-empty-heading"
          className="account-state"
          role="status"
        >
          <Info aria-hidden="true" className="account-state__icon" size={34} />
          <p className="eyebrow">Account</p>
          <h1 id="profile-empty-heading">Profile unavailable</h1>
          <p>Belikeme could not read a profile for this session.</p>
          <div className="account-state__actions">
            <Link className="button button--primary" href="/login?next=%2Fprofile">
              Sign in again
            </Link>
            <Link className="button button--secondary" href="/products">
              Back to products
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-page profile-page">
      <section className="unified-profile-panel" aria-labelledby="profile-heading">
        <header className="unified-profile-panel__header">
          <div>
            <p className="eyebrow">Account</p>
            <h1 id="profile-heading">Account Details</h1>
            <p>Manage your contact details and delivery addresses.</p>
          </div>
          <Link className="button button--secondary" href="/orders">
            <ReceiptText aria-hidden="true" size={17} />
            Orders
          </Link>
        </header>

        <ProfileForm user={currentUser} />
        <AddressBook />
      </section>
    </main>
  );
}
