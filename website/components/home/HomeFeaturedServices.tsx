import Link from "next/link";
import type { ServiceType } from "@emmasenvy/shared";
import { Card } from "@/components/ui/Card";

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  return `$${price}`;
}

export function HomeFeaturedServices({ services }: { services: ServiceType[] }) {
  const featured = services.slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-semibold text-white">Services</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {featured.map((svc) => (
          <Link key={svc.id} href="/book" className="block">
            <Card interactive className="h-full">
              <h3 className="text-lg font-semibold text-white">{svc.title}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-pink-light/90">
                <span>{formatPrice(svc.price)}</span>
                {svc.duration_needed ? (
                  <>
                    <span className="text-white/40">·</span>
                    <span>{svc.duration_needed}</span>
                  </>
                ) : null}
              </div>
              {svc.description ? (
                <p className="mt-2 text-sm leading-relaxed text-white/75">{svc.description}</p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
