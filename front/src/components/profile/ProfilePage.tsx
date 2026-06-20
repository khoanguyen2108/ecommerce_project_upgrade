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
      <section className="customer-hero" aria-labelledby="profile-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1 id="profile-heading">Profile</h1>
          <p>
            Keep your contact details current. Email, role, and sign-in provider
            are read-only here.
          </p>
        </div>
        <Link className="button button--secondary" href="/orders">
          <ReceiptText aria-hidden="true" size={17} />
          Orders
        </Link>
      </section>

      <ProfileForm user={currentUser} />
      <AddressBook />
    </main>
  );
}
