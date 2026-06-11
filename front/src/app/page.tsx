import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LandingPage } from "@/components/marketing/LandingPage";

export default function HomePage() {
  return (
    <>
      <SiteHeader active="shop" />
      <LandingPage />
      <SiteFooter />
    </>
  );
}
