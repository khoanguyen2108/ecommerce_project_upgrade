"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { AddressBook } from "@/components/profile/AddressBook";
import { useI18n } from "@/features/i18n/useI18n";

export function ProfilePage() {
  const { currentUser } = useAuthSession();
  const { t } = useI18n();

  if (!currentUser) {
    return (
      <main className="account-state-page">
        <section
          aria-labelledby="profile-empty-heading"
          className="account-state"
          role="status"
        >
          <Info aria-hidden="true" className="account-state__icon" size={34} />
          <p className="eyebrow">{t("profile.account")}</p>
          <h1 id="profile-empty-heading">{t("profile.unavailable")}</h1>
          <p>{t("profile.unavailableBody")}</p>
          <div className="account-state__actions">
            <Link className="button button--primary" href="/login?next=%2Fprofile">
              {t("profile.signInAgain")}
            </Link>
            <Link className="button button--secondary" href="/products">
              {t("profile.backProducts")}
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
            <h1 id="profile-heading">{t("profile.title")}</h1>
            <p>{t("profile.intro")}</p>
          </div>
        </header>

        <ProfileForm user={currentUser} />
        <AddressBook />
      </section>
    </main>
  );
}
