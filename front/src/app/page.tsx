import type { Metadata } from "next";
import { BelikemeIntroPage } from "@/components/landing/BelikemeIntroPage";

export const metadata: Metadata = {
  title: "BELIKEME",
  description:
    "A cinematic interactive BELIKEME logo intro for the customer storefront.",
};

export default function HomePage() {
  return <BelikemeIntroPage />;
}
