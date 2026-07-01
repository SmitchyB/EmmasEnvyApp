import type { Metadata } from "next";

import Image from "next/image";

import {
  fetchPublicServiceTypes,
  getPrimaryPortfolio,
  getSiteSettings,
  listAvailableRewardOfferings,
  uploadsUrl,
} from "@emmasenvy/shared";

import { ensureSharedConfig } from "@/lib/api-init";

import { HomeCtaStrip } from "@/components/home/HomeCtaStrip";
import { HomeFeaturedServices } from "@/components/home/HomeFeaturedServices";
import { HomeFinalCta } from "@/components/home/HomeFinalCta";
import { HomeMeetArtist } from "@/components/home/HomeMeetArtist";
import { HomePortfolioPreview } from "@/components/home/HomePortfolioPreview";
import { HomeRewardsTeaser } from "@/components/home/HomeRewardsTeaser";
import { HomeTrustBullets } from "@/components/home/HomeTrustBullets";
import { HomeWelcomeBack } from "@/components/home/HomeWelcomeBack";
import { JsonLd } from "@/components/seo/JsonLd";

import { absoluteUrl, defaultDescription, siteName } from "@/lib/seo";

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

  const [settingsResult, portfolioResult, servicesResult, rewardsResult] = await Promise.allSettled([
    getSiteSettings(),
    getPrimaryPortfolio(),
    fetchPublicServiceTypes(),
    listAvailableRewardOfferings(),
  ]);

  const settings = settingsResult.status === "fulfilled" ? settingsResult.value : null;
  const portfolio =
    portfolioResult.status === "fulfilled" ? portfolioResult.value?.portfolio ?? null : null;
  const services = servicesResult.status === "fulfilled" ? servicesResult.value : [];
  const rewardOfferings = rewardsResult.status === "fulfilled" ? rewardsResult.value : [];

  const heroUri = settings ? uploadsUrl(settings.home_hero_image) : null;
  const title = settings?.hero_title?.trim() || siteName;
  const body = settings?.home_hero_material?.trim();

  const salonJsonLd = {
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

  const servicesJsonLd =
    services.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: services.slice(0, 4).map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Service",
              name: s.title,
              description: s.description,
              offers: { "@type": "Offer", price: s.price ?? 0, priceCurrency: "USD" },
            },
          })),
        }
      : null;

  return (
    <>
      <JsonLd data={salonJsonLd} />
      {servicesJsonLd ? <JsonLd data={servicesJsonLd} /> : null}
      <PageContainer width="md" className="space-y-12">
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

        <HomeWelcomeBack serviceTypes={services} />

        {body ? (
          <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed text-white/90">{body}</p>
        ) : null}

        <HomeCtaStrip />

        {portfolio ? <HomePortfolioPreview portfolio={portfolio} /> : null}

        <HomeFeaturedServices services={services} />

        {portfolio ? <HomeMeetArtist portfolio={portfolio} /> : null}

        {settings ? <HomeTrustBullets settings={settings} /> : null}

        {settings ? (
          <HomeRewardsTeaser settings={settings} offerings={rewardOfferings} />
        ) : null}

        <HomeFinalCta />
      </PageContainer>
    </>
  );
}
