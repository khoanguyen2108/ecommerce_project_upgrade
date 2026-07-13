import { IntroGate } from "@/components/landing/IntroGate";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LandingPage } from "@/components/marketing/LandingPage";

export default function HomePage() {
  return (
    <IntroGate>
      <SiteHeader />
      <LandingPage />
      <SiteFooter />
    </IntroGate>
  );
}
