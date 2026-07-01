import type { Metadata } from "next";
import { BookAppointmentWizard } from "@/components/pages/BookAppointmentWizard";
import { SearchParamsSuspense } from "@/components/SearchParamsSuspense";
import { ensureSharedConfig } from "@/lib/api-init";
import { fetchPublicServiceTypes } from "@emmasenvy/shared";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, defaultDescription } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: `Schedule your nail appointment online. ${defaultDescription}`,
  openGraph: { url: absoluteUrl("/book") },
};

export const revalidate = 300;

export default async function BookPage() {
  ensureSharedConfig();
  let services: Awaited<ReturnType<typeof fetchPublicServiceTypes>> = [];
  try {
    services = await fetchPublicServiceTypes();
  } catch {
    services = [];
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Service",
        name: s.title,
        description: s.description,
        offers: { "@type": "Offer", price: s.price ?? 0, priceCurrency: "USD" },
      },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <SearchParamsSuspense>
        <BookAppointmentWizard initialServices={services} />
      </SearchParamsSuspense>
    </>
  );
}
