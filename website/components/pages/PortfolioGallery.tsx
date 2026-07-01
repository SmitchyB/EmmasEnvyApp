"use client";



import Image from "next/image";

import { useCallback, useEffect, useState } from "react";

import { getPrimaryPortfolio, uploadsUrl, type Portfolio, type PortfolioPhoto } from "@emmasenvy/shared";

import { Button } from "@/components/ui/Button";

import { Card } from "@/components/ui/Card";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import { Modal } from "@/components/ui/Modal";

import { JsonLd } from "@/components/seo/JsonLd";

import { absoluteUrl } from "@/lib/seo";



type PortfolioWithPhotos = Portfolio & { photos: PortfolioPhoto[] };



export function PortfolioGallery() {

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [portfolio, setPortfolio] = useState<PortfolioWithPhotos | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const result = await getPrimaryPortfolio();

      setPortfolio(result?.portfolio ?? null);

    } catch (e) {

      setError(e instanceof Error ? e.message : "Failed to load portfolio");

      setPortfolio(null);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  const photos = portfolio?.photos ?? [];

  const portraitUrl = portfolio ? uploadsUrl(portfolio.portrait) : null;



  const jsonLd =

    photos.length > 0

      ? {

          "@context": "https://schema.org",

          "@type": "ImageGallery",

          name: portfolio?.name || "Emmas Envy Portfolio",

          image: photos.map((p) => uploadsUrl(p.url)).filter(Boolean),

          url: absoluteUrl("/portfolio"),

        }

      : null;



  if (loading && !portfolio) return <LoadingSpinner />;

  if (error) {

    return (

      <Card>

        <p className="text-red-200">{error}</p>

        <Button variant="secondary" className="mt-4" onClick={() => void load()}>

          Try again

        </Button>

      </Card>

    );

  }

  if (!portfolio) {

    return <p className="text-white/70">No portfolio published yet.</p>;

  }



  return (

    <>

      {jsonLd ? <JsonLd data={jsonLd} /> : null}

      <Card className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">

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

          <h2 className="text-xl font-semibold">{portfolio.name}</h2>

          {portfolio.description ? (

            <p className="mt-1 text-sm leading-relaxed text-white/75">{portfolio.description}</p>

          ) : null}

        </div>

      </Card>



      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">

        {photos.map((photo, index) => {

          const url = uploadsUrl(photo.url);

          if (!url) return null;

          return (

            <button

              key={photo.id}

              type="button"

              className="group relative aspect-square overflow-hidden rounded-xl shadow-md transition hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"

              onClick={() => setLightboxIndex(index)}

            >

              <Image src={url} alt={photo.caption || "Portfolio photo"} fill className="object-cover" />

              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />

            </button>

          );

        })}

      </div>



      {photos.length === 0 ? <p className="mt-4 text-white/70">No photos yet.</p> : null}



      <div className="mt-8 text-center">

        <Button href="/book">Book now</Button>

      </div>



      <Modal

        open={lightboxIndex !== null}

        onClose={() => setLightboxIndex(null)}

        wide

        title={photos[lightboxIndex ?? 0]?.caption || "Portfolio photo"}

        footer={

          lightboxIndex !== null ? (

            <>

              <Button

                variant="secondary"

                className="flex-1"

                disabled={lightboxIndex <= 0}

                onClick={() => setLightboxIndex((i) => (i !== null ? i - 1 : null))}

              >

                Previous

              </Button>

              <Button

                variant="secondary"

                className="flex-1"

                disabled={lightboxIndex >= photos.length - 1}

                onClick={() => setLightboxIndex((i) => (i !== null ? i + 1 : null))}

              >

                Next

              </Button>

            </>

          ) : null

        }

      >

        {lightboxIndex !== null && photos[lightboxIndex] ? (

          (() => {

            const url = uploadsUrl(photos[lightboxIndex].url);

            return url ? (

              <Image

                src={url}

                alt=""

                width={800}

                height={800}

                className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"

              />

            ) : null;

          })()

        ) : null}

      </Modal>

    </>

  );

}

