import type { Metadata } from "next";
import Image from "next/image";
import { getSiteSettings, uploadsUrl } from "@emmasenvy/shared";
import { ensureSharedConfig } from "@/lib/api-init";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, defaultDescription, siteName } from "@/lib/seo";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  ensureSharedConfig();
  let description = defaultDescription;
  let title = siteName;
  let image: string | undefined;
  try {
    const settings = await getSiteSettings();
    if (settings?.hero_title?.trim()) title = settings.hero_title.trim();
    if (settings?.home_hero_material?.trim()) description = settings.home_hero_material.trim();
    const hero = settings ? uploadsUrl(settings.home_hero_image) : null;
    if (hero) image = hero;
  } catch {
    // use defaults
  }
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [image] : undefined, url: absoluteUrl("/") },
  };
}

export default async function HomePage() {
  ensureSharedConfig();
  const settings = await getSiteSettings();
  const heroUri = settings ? uploadsUrl(settings.home_hero_image) : null;
  const title = settings?.hero_title?.trim() || siteName;
  const body = settings?.home_hero_material?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: siteName,
    url: absoluteUrl("/"),
    image: heroUri || absoluteUrl("/logo.png"),
    potentialAction: {
      "@type": "ReserveAction",
      target: absoluteUrl("/book"),
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageContainer width="md" className="space-y-10">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/20 shadow-card sm:aspect-[5/4] md:aspect-[16/9]">
          {heroUri ? (
            <Image
              src={heroUri}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-cover object-top"
              priority
            />
          ) : (
            <div className="h-full bg-black/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <h1 className="absolute bottom-4 left-4 right-4 text-center text-3xl font-bold text-white md:text-4xl">
            {title}
          </h1>
        </div>
        {body ? (
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <p className="text-lg leading-relaxed text-white/90">{body}</p>
            <Button href="/book">Book an appointment</Button>
          </div>
        ) : (
          <div className="text-center">
            <Button href="/book">Book an appointment</Button>
          </div>
        )}
      </PageContainer>
    </>
  );
}
