import type { Metadata } from "next";
import { PortfolioGallery } from "@/components/pages/PortfolioGallery";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/ui/PageContainer";
import { absoluteUrl, defaultDescription } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Portfolio",
  description: `Browse recent nail art and services at Emmas Envy. ${defaultDescription}`,
  openGraph: { url: absoluteUrl("/portfolio") },
};

export default function PortfolioPage() {
  return (
    <PageContainer width="lg">
      <PageHeader title="Portfolio" subtitle="Browse recent work" />
      <PortfolioGallery />
    </PageContainer>
  );
}
