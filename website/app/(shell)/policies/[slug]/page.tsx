import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteSettings } from "@emmasenvy/shared";
import { ensureSharedConfig } from "@/lib/api-init";
import { getPolicyBySlug, POLICY_PAGES } from "@/lib/policies";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 300;

export function generateStaticParams() {
  return POLICY_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);
  if (!policy) return {};
  return {
    title: policy.title,
    openGraph: { url: absoluteUrl(`/policies/${slug}`) },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);
  if (!policy) notFound();

  ensureSharedConfig();
  const settings = await getSiteSettings();
  const content = settings ? settings[policy.field] : null;

  return (
    <article>
      <h1 className="mb-6 text-2xl font-bold text-white">{policy.title}</h1>
      {content ? (
        <div className="prose-policy rounded-xl border border-white/20 bg-white/10 p-6 text-white/90">
          {content}
        </div>
      ) : (
        <p className="text-white/70">This policy has not been published yet.</p>
      )}
    </article>
  );
}
