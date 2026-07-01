import Image from "next/image";
import Link from "next/link";
import { uploadsUrl, type Portfolio, type PortfolioPhoto } from "@emmasenvy/shared";
import { Button } from "@/components/ui/Button";

type PortfolioWithPhotos = Portfolio & { photos: PortfolioPhoto[] };

export function HomePortfolioPreview({ portfolio }: { portfolio: PortfolioWithPhotos }) {
  const photos = [...(portfolio.photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 6);

  if (photos.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-semibold text-white">Recent work</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {photos.map((photo) => {
          const url = uploadsUrl(photo.url);
          if (!url) return null;
          return (
            <Link
              key={photo.id}
              href="/portfolio"
              className="group relative aspect-square overflow-hidden rounded-xl shadow-md transition hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Image
                src={url}
                alt={photo.caption || "Portfolio photo"}
                fill
                sizes="(max-width: 768px) 50vw, 200px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
            </Link>
          );
        })}
      </div>
      <div className="text-center">
        <Button href="/portfolio" variant="secondary">
          See all work
        </Button>
      </div>
    </section>
  );
}
