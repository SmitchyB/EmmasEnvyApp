import type { MetadataRoute } from "next";
import { POLICY_PAGES } from "@/lib/policies";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["/", "/portfolio", "/book", "/rewards"].map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
  const policyRoutes = POLICY_PAGES.map((p) => ({
    url: absoluteUrl(`/policies/${p.slug}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
  return [...staticRoutes, ...policyRoutes];
}
