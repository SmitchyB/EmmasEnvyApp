import Image from "next/image";
import { uploadsUrl, type Portfolio } from "@emmasenvy/shared";
import { Card } from "@/components/ui/Card";

export function HomeMeetArtist({ portfolio }: { portfolio: Portfolio }) {
  const portraitUrl = uploadsUrl(portfolio.portrait);
  if (!portfolio.name && !portfolio.description && !portraitUrl) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-semibold text-white">Meet Emma</h2>
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {portraitUrl ? (
          <Image
            src={portraitUrl}
            alt={portfolio.name || "Stylist"}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-white/30 shadow-md"
          />
        ) : null}
        <div>
          {portfolio.name ? (
            <h3 className="text-xl font-semibold text-white">{portfolio.name}</h3>
          ) : null}
          {portfolio.description ? (
            <p className="mt-1 text-sm leading-relaxed text-white/75">{portfolio.description}</p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
