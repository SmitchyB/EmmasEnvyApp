import Link from "next/link";
import type { SiteSettings } from "@emmasenvy/shared";
import { Card } from "@/components/ui/Card";

const TRUST_ITEMS = [
  {
    slug: "cancellation",
    title: "Flexible cancellation",
    field: "policy_appointment_cancellation" as const,
  },
  {
    slug: "service-guarantee",
    title: "Service guarantee",
    field: "policy_service_guarantee_fix" as const,
  },
  {
    slug: "rewards",
    title: "Rewards program",
    field: "policy_rewards_loyalty" as const,
  },
] as const;

function truncateExcerpt(text: string, maxLen = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

export function HomeTrustBullets({ settings }: { settings: SiteSettings }) {
  const items = TRUST_ITEMS.map((item) => {
    const body = settings[item.field]?.trim();
    if (!body) return null;
    return { ...item, excerpt: truncateExcerpt(body) };
  }).filter(Boolean) as { slug: string; title: string; excerpt: string }[];

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-semibold text-white">Why book with us</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.slug} className="flex flex-col">
            <h3 className="font-semibold text-white">{item.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">{item.excerpt}</p>
            <Link
              href={`/policies/${item.slug}`}
              className="mt-3 text-sm font-medium text-pink-light hover:text-white"
            >
              Learn more
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
