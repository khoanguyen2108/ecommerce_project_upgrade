import type { Metadata } from "next";
import { StyleAssistant } from "@/components/ai/StyleAssistant";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Style Assistant",
  description:
    "Create a personalized outfit edit from Belikeme's current catalog.",
};

export default function StyleAssistantPage() {
  return (
    <>
      <SiteHeader active="ai" />
      <StyleAssistant />
      <SiteFooter />
    </>
  );
}
